import os
import torch
import joblib
import numpy as np
from ray import serve


@serve.deployment
class TaskClassifierDeployment:
    """
    Task classifier using BERT embeddings + MLP to classify queries as:
    - caption
    - vqa  
    - grounding
    """
    
    def __init__(self, model_path: str = None, device: str = None):
        from transformers import BertTokenizer, BertModel
        
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        
        print(f"[TaskClassifier] Using device: {self.device}")
        
        # Load BERT for embeddings
        print("[TaskClassifier] Loading BERT tokenizer and model...")
        self.tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
        self.bert = BertModel.from_pretrained('bert-base-uncased')
        self.bert.to(self.device)
        self.bert.eval()
        
        # Default model path if not provided
        if model_path is None:
            model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "Task_Classifier")
        
        # Load MLP classifier, scaler, and label encoder
        self.use_heuristic = True
        if model_path and os.path.exists(model_path):
            mlp_path = os.path.join(model_path, "mlp_query_classifier.joblib")
            scaler_path = os.path.join(model_path, "scaler_query_classifier.joblib")
            le_path = os.path.join(model_path, "label_encoder_query_classifier.joblib")
            
            if all(os.path.exists(p) for p in [mlp_path, scaler_path, le_path]):
                print(f"[TaskClassifier] Loading MLP classifier from {model_path}")
                try:
                    self.mlp = joblib.load(mlp_path)
                    self.scaler = joblib.load(scaler_path)
                    self.label_encoder = joblib.load(le_path)
                    self.use_heuristic = False
                    print("[TaskClassifier] MLP classifier loaded successfully.")
                except Exception as e:
                    print(f"[TaskClassifier] Failed to load MLP classifier: {e}. Using heuristic.")
            else:
                print(f"[TaskClassifier] Model files not found in {model_path}. Using heuristic.")
        else:
            print(f"[TaskClassifier] Model path not found: {model_path}. Using heuristic.")

    def _get_bert_embedding(self, text: str) -> np.ndarray:
        """Get BERT CLS token embedding for a single text."""
        inputs = self.tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=128,
            return_tensors="pt"
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.bert(**inputs)
        
        # CLS token embedding
        cls_embedding = outputs.last_hidden_state[:, 0, :]
        return cls_embedding.cpu().numpy()

    async def predict(self, text: str) -> str:
        """
        Predict the task type for a given query text.
        Returns one of: 'caption', 'vqa', 'grounding', 'area'
        """
        text_lower = text.lower()
        
        # Priority heuristic: if "area" is in query, classify as "area"
        if "area" in text_lower:
            return "area"
        
        if self.use_heuristic:
            # Fallback to simple heuristic
            if "find" in text_lower or "locate" in text_lower or "segment" in text_lower or "detect" in text_lower:
                return "grounding"
            if "caption" in text_lower or "describe" in text_lower:
                return "caption"
            if "?" in text:
                return "vqa"
            return "caption"
        
        # Use MLP classifier
        embedding = self._get_bert_embedding(text)
        embedding_scaled = self.scaler.transform(embedding)
        pred_idx = self.mlp.predict(embedding_scaled)
        label = self.label_encoder.inverse_transform(pred_idx)[0]
        
        # Normalize labels to match router expectations
        # The MLP may return "captioning" but router expects "caption"
        label_mapping = {
            "captioning": "caption",
            "caption": "caption",
            "vqa": "vqa",
            "grounding": "grounding",
            "area": "area",
        }
        
        return label_mapping.get(label, label)
