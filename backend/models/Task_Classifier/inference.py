# inference.py

import os
import torch
import joblib
import numpy as np
from transformers import BertTokenizer, BertModel


class EndpointHandler:
    """
    Custom handler for Hugging Face Inference Endpoints.

    Expected input JSON:
        {"inputs": "some text"}
      or {"inputs": ["text 1", "text 2", ...]}

    Output:
        For single input:
            {"label": "...", "confidence": 0.95}
        For multiple:
            [
                {"label": "...", "confidence": 0.95},
                {"label": "...", "confidence": 0.80},
                ...
            ]
    """

    def __init__(self, path: str = "."):
        # 1. Device setup
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[handler] Using device: {self.device}")

        # 2. Load BERT
        print("[handler] Loading BERT tokenizer and model...")
        self.tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
        self.bert_model = BertModel.from_pretrained("bert-base-uncased")
        self.bert_model.to(self.device)
        self.bert_model.eval()

        # 3. Load MLP, scaler, label encoder
        print("[handler] Loading classification components...")
        mlp_path = os.path.join(path, "mlp_query_classifier.joblib")
        scaler_path = os.path.join(path, "scaler_query_classifier.joblib")
        le_path = os.path.join(path, "label_encoder_query_classifier.joblib")

        self.mlp = joblib.load(mlp_path)
        self.scaler = joblib.load(scaler_path)
        self.le = joblib.load(le_path)

        print("[handler] Loaded MLP, scaler, and label encoder.")

    # ------------ Helper: BERT embeddings ------------
    def get_bert_embeddings(self, text_list):
        inputs = self.tokenizer(
            text_list,
            padding=True,
            truncation=True,
            max_length=128,
            return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            outputs = self.bert_model(**inputs)

        # CLS token embedding
        cls_embeddings = outputs.last_hidden_state[:, 0, :]
        return cls_embeddings.cpu().numpy()

    # ------------ Main entry point ------------
    def __call__(self, data):
        """
        data: dict with key "inputs"
        """
        if "inputs" not in data:
            raise ValueError("Input JSON must have an 'inputs' field.")

        texts = data["inputs"]

        # Normalize to list
        is_single = False
        if isinstance(texts, str):
            texts = [texts]
            is_single = True

        # 1) BERT embedding
        embeddings = self.get_bert_embeddings(texts)

        # 2) Scale with same scaler as training
        embeddings_scaled = self.scaler.transform(embeddings)

        # 3) Predict class indices
        pred_indices = self.mlp.predict(embeddings_scaled)

        # 4) Map indices to labels
        labels = self.le.inverse_transform(pred_indices)

        # 5) Optionally, get probabilities
        results = []
        for i, idx in enumerate(pred_indices):
            label = labels[i]
            try:
                probs = self.mlp.predict_proba(embeddings_scaled[i : i + 1])[0]
                confidence = float(np.max(probs))
            except Exception:
                confidence = None

            result = {"label": label}
            results.append(result)

        # If the user sent a single string, return a single dict
        if is_single:
            return results[0]
        return results
