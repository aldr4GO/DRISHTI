---
library_name: transformers
tags:
- text-classification
- bert
- query-routing
- sklearn
- mlp
license: unknown
language:
- en
pipeline_tag: text-classification
---
# Freakdivi – BERT Query Router

## Model Description

A BERT-based sequence classification model that routes natural-language queries into predefined categories.  
The model encodes each query with **bert-base-uncased** and feeds the `[CLS]` embedding to a scikit-learn MLP classifier.

This repository contains:

- `mlp_query_classifier.joblib` – trained MLP classifier
- `scaler_query_classifier.joblib` – feature scaler used on BERT embeddings
- `label_encoder_query_classifier.joblib` – maps class indices ↔ string labels
- `inference.py` – handler used by Hugging Face Inference Endpoints

> ⚠️ **TODO:** Replace the task + label descriptions below with your actual ones.

---

## Task

**Multi-class text classification / query routing**

Given an input query, the model predicts one of *N* categories, such as:

| ID | Label        | Description                              |
|----|--------------|------------------------------------------|
| 0  | `LABEL_0` 📝 | *TODO: short description of label 0*    |
| 1  | `LABEL_1` 📝 | *TODO: short description of label 1*    |
| 2  | `LABEL_2` 📝 | *TODO: short description of label 2*    |
| 3  | `LABEL_3` 📝 | *TODO: add/remove rows as needed*       |

You can get the exact list of labels by checking the `label_encoder_query_classifier.joblib` in code:

```