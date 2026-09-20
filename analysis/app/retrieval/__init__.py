"""Retrieval. Tier 2 question answering, with policy documents at Tier 3.

Used to answer questions and to let a brief quote the company's own policy. Never used to
detect, to assign severity or to score: the detectors do not import this package, and a test
proves findings and scores are identical with it switched off.
"""
