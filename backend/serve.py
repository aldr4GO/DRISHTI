import argparse
import os
import time

import ray
from ray import serve
import torch
from starlette.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware

# Import deployment classes from deployments package
from deployments import (
    EarthMindDeployment,
    RemoteSAMDeployment,
    TaskClassifierDeployment,
    RouterDeployment,
    PhiDeployment,
)


def parse_args():
    parser = argparse.ArgumentParser(description="Start Ray Serve for EarthMind and RemoteSAM models")
    parser.add_argument("--earthmind_path", default="./models/EarthMind-4B")
    parser.add_argument("--remotesam_path", default="./models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth")
    parser.add_argument("--classifier_path", default="./models/Task_Classifier", help="Path to the task classifier model directory")
    parser.add_argument("--phi_model", default="microsoft/Phi-3.5-mini-instruct", help="Phi-3.5 model ID for prompt refinement")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--load_8bit", action="store_true")
    parser.add_argument("--dtype", type=str, default="float16", choices=["auto", "float16", "bfloat16", "float32"], help="Model precision")
    parser.add_argument("--no_ray_init", action="store_true", help="Do not call ray.init() (useful if ray already initialized)")
    parser.add_argument("--ray_temp_dir", type=str, default=None, help="Directory for Ray temporary files")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if not args.no_ray_init:
        ray.init(address=os.environ.get("RAY_ADDRESS", None), _temp_dir=args.ray_temp_dir)

    # Deploy the model. Prefer GPU if available
    if torch.cuda.is_available():
        total_gpus = torch.cuda.device_count()
        if total_gpus >= 3:
            earthmind_gpus = 1.0
            remotesam_gpus = 1.0
            phi_gpus = 1.0
        elif total_gpus >= 2:
            earthmind_gpus = 1.0
            remotesam_gpus = 0.5
            phi_gpus = 0.5
        else:
            # Share the single GPU
            earthmind_gpus = 0.4
            remotesam_gpus = 0.3
            phi_gpus = 0.3
    else:
        earthmind_gpus = 0
        remotesam_gpus = 0
        phi_gpus = 0

    serve.start(http_options={
        "host": args.host,
        "port": args.port,
        "middlewares": [
            Middleware(
                CORSMiddleware,
                allow_origin_regex=".*",
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
        ]
    })

    print(f"Deploying EarthMind with {earthmind_gpus} GPUs...")
    earthmind_deployment = EarthMindDeployment.options(
        num_replicas=1, 
        ray_actor_options={"num_gpus": earthmind_gpus},
        name="earthmind"
    ).bind(model_path=args.earthmind_path, load_8bit=args.load_8bit, dtype=args.dtype)
    
    # We need to start the deployment to get a handle, but .bind() returns a bound deployment.
    # In Ray Serve 2.0+, we compose them.
    # However, to pass handles to Router, we usually need them running or use names.
    # But .bind() is for the "app" style.
    # If we want to use handles inside Router, we can pass the BoundDeployments to Router.bind()
    
    print(f"Deploying RemoteSAM with {remotesam_gpus} GPUs...")
    remotesam_deployment = RemoteSAMDeployment.options(
        num_replicas=1,
        ray_actor_options={
            "num_gpus": remotesam_gpus,
            "runtime_env": {"env_vars": {"PYTHONNOUSERSITE": "1"}}
        },
        name="remotesam"
    ).bind(checkpoint_path=args.remotesam_path)

    print(f"Deploying Task Classifier...")
    # Run classifier on CPU to save GPU memory for main models, or use small fraction if needed
    classifier_deployment = TaskClassifierDeployment.options(
        num_replicas=1,
        ray_actor_options={"num_gpus": 0}, 
        name="classifier"
    ).bind(model_path=args.classifier_path)

    print(f"Deploying Phi-3.5 for prompt refinement with {phi_gpus} GPUs...")
    phi_deployment = PhiDeployment.options(
        num_replicas=1,
        ray_actor_options={"num_gpus": phi_gpus},
        name="phi"
    ).bind(model_id=args.phi_model)

    print("Deploying Router...")
    router_deployment = RouterDeployment.options(
        num_replicas=1,
        name="router"
    ).bind(earthmind_handle=earthmind_deployment, remotesam_handle=remotesam_deployment, classifier_handle=classifier_deployment, phi_handle=phi_deployment)

    serve.run(router_deployment, name="earthmind_app", route_prefix="/")

    # Ray Serve will expose the FastAPI app. We print the route for convenience.
    print(f"EarthMind Ray Serve deployment 'earthmind_app' started at http://{args.host}:{args.port}/predict")

    try:
        import time
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        print("Stopping server...")
