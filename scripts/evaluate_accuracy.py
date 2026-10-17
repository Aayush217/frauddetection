#!/usr/bin/env python3
"""
FraudGraph Detection Accuracy Evaluator
---------------------------------------
Computes and reports Precision, Recall, and F1-Score for all three fraud patterns
(P1: Shared-Device, P2: Circular Flows, P3: Mule Accounts) against ground_truth.json.

Usage:
    python scripts/evaluate_accuracy.py
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.services.detection import DetectionService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fraudgraph.evaluator")


def load_ground_truth(gt_path: Path) -> Dict[str, Any]:
    with open(gt_path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_p1_shared_devices(gt_rings: List[dict]) -> Dict[str, float]:
    """
    Evaluates P1 Shared-Device ring detection.
    Matches detected devices against ground truth syndicate devices.
    """
    gt_p1 = [r for r in gt_rings if r["pattern"] == "P1"]
    gt_devices = {r["device_id"]: set(r["member_account_ids"]) for r in gt_p1}

    det_res = DetectionService.detect_shared_devices(min_accounts=4)
    detected_rings = det_res["results"]

    tp = 0
    fp = 0
    matched_gt = set()

    for det in detected_rings:
        det_members = set(det["member_account_ids"])
        det_dev = det["device_id"]

        matched = False
        for gt_dev, gt_members in gt_devices.items():
            # Check device ID match or significant member overlap (Jaccard >= 0.7)
            overlap = len(det_members & gt_members) / len(det_members | gt_members)
            if det_dev == gt_dev or overlap >= 0.7:
                matched = True
                matched_gt.add(gt_dev)
                break

        if matched:
            tp += 1
        else:
            fp += 1

    fn = len(gt_devices) - len(matched_gt)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "pattern": "P1",
        "name": "Shared-Device Rings",
        "ground_truth_count": len(gt_devices),
        "detected_count": len(detected_rings),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
    }


def evaluate_p2_cycles(gt_rings: List[dict]) -> Dict[str, float]:
    """
    Evaluates P2 Circular-Flow detection.
    Matches detected cycles against ground truth cycles by member set.
    """
    gt_p2 = [r for r in gt_rings if r["pattern"] == "P2"]
    gt_cycles = [set(r["member_account_ids"]) for r in gt_p2]

    det_res = DetectionService.detect_cycles(min_len=3, max_len=6, window_hours=72.0, min_volume=1000.0)
    detected_cycles = det_res["results"]

    tp = 0
    fp = 0
    matched_gt = set()

    for det in detected_cycles:
        det_members = set(det["member_account_ids"])
        matched = False
        for idx, gt_members in enumerate(gt_cycles):
            if det_members == gt_members:
                matched = True
                matched_gt.add(idx)
                break

        if matched:
            tp += 1
        else:
            fp += 1

    fn = len(gt_cycles) - len(matched_gt)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "pattern": "P2",
        "name": "Circular Money Flows",
        "ground_truth_count": len(gt_cycles),
        "detected_count": len(detected_cycles),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
    }


def evaluate_p3_mules(gt_rings: List[dict]) -> Dict[str, float]:
    """
    Evaluates P3 Mule account detection.
    Matches detected mule account IDs against ground truth mule accounts.
    """
    gt_p3 = [r for r in gt_rings if r["pattern"] == "P3"]
    gt_mules = {r["mule_account_id"] for r in gt_p3}

    # Strict mule detection with minimum inflow >= 10,000 for primary syndicates
    det_res = DetectionService.detect_mules(
        min_fan_in=5,
        max_dwell_hours=24.0,
        min_inflow=10000.0,
        min_outflow_ratio=0.80,
    )
    detected_mules = {r["mule_account_id"] for r in det_res["results"]}

    tp = len(detected_mules & gt_mules)
    fp = len(detected_mules - gt_mules)
    fn = len(gt_mules - detected_mules)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "pattern": "P3",
        "name": "Mule Accounts",
        "ground_truth_count": len(gt_mules),
        "detected_count": len(detected_mules),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
    }


def run_evaluation() -> Dict[str, Any]:
    gt_path = Path(__file__).resolve().parent / "ground_truth.json"
    if not gt_path.exists():
        gt_path = Path(__file__).resolve().parent.parent / "backend" / "data" / "ground_truth.json"

    if not gt_path.exists():
        raise FileNotFoundError(f"ground_truth.json not found at {gt_path}. Run generate_data.py first.")

    gt_data = load_ground_truth(gt_path)
    gt_rings = gt_data["rings"]

    p1_metrics = evaluate_p1_shared_devices(gt_rings)
    p2_metrics = evaluate_p2_cycles(gt_rings)
    p3_metrics = evaluate_p3_mules(gt_rings)

    # Print Formatted Report Table
    header = f"{'Pattern':<8} | {'Description':<24} | {'GT':<4} | {'Det':<4} | {'TP':<4} | {'FP':<4} | {'FN':<4} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}"
    divider = "-" * len(header)

    print("\n" + "=" * len(header))
    print("FRAUDGRAPH DETECTION ACCURACY EVALUATION REPORT")
    print("=" * len(header))
    print(header)
    print(divider)

    for m in [p1_metrics, p2_metrics, p3_metrics]:
        print(
            f"{m['pattern']:<8} | {m['name']:<24} | {m['ground_truth_count']:<4} | {m['detected_count']:<4} | "
            f"{m['tp']:<4} | {m['fp']:<4} | {m['fn']:<4} | {m['precision']:<10.2%} | {m['recall']:<10.2%} | {m['f1_score']:<10.2%}"
        )
    print("=" * len(header) + "\n")

    return {
        "p1": p1_metrics,
        "p2": p2_metrics,
        "p3": p3_metrics,
    }


if __name__ == "__main__":
    run_evaluation()
