#!/usr/bin/env python3
"""
Flexible Word Order Matching Script for MMLU Scores

This script matches AI models from model-scores.json to benchmark scores in models.json
using exact matching with word order flexibility for 3-4 word model names.

Usage:
    python flexible_word_order_matching.py

Output:
    - Updates model-scores.json with MMLU scores
    - Creates flexible_word_order_matches_detailed.json with match details
"""

import json
import re
from itertools import permutations

def load_datasets():
    """Load the benchmark and API model datasets"""
    with open('models.json', 'r') as f:
        models_data = json.load(f)
        benchmark_models = models_data['data']

    with open('model-scores.json', 'r') as f:
        api_models = json.load(f)

    return benchmark_models, api_models

def create_benchmark_lookup(benchmark_models):
    """Create normalized benchmark name lookup"""
    benchmark_names = {}
    for model in benchmark_models:
        name_key = re.sub(r'\s+', ' ', model['name'].lower().strip())
        benchmark_names[name_key] = model
    return benchmark_names

def flexible_order_match(api_model, benchmark_names):
    """
    Match API model to benchmark with word order flexibility

    Args:
        api_model: API model dictionary
        benchmark_names: Benchmark name lookup dictionary

    Returns:
        Match dictionary or None
    """
    short_name = api_model.get('short_name', '')
    if not short_name:
        return None

    # Normalize short name
    normalized_short = re.sub(r'\s+', ' ', short_name.lower().strip())

    # Generate permutations for names with 3-4 words
    words = normalized_short.split()
    permutations_to_check = {normalized_short}  # Include original

    if len(words) >= 3 and len(words) <= 4:
        word_perms = [' '.join(p) for p in permutations(words)]
        permutations_to_check.update(word_perms)

    # Check each permutation against benchmark names
    for perm in permutations_to_check:
        if perm in benchmark_names:
            bench_model = benchmark_names[perm]
            if bench_model.get('evaluations', {}).get('mmlu_pro') is not None:
                return {
                    'api_model': api_model,
                    'benchmark_model': bench_model,
                    'mmlu_score': bench_model['evaluations']['mmlu_pro'],
                    'match_type': 'direct_word_order_flexible',
                    'original_short_name': short_name,
                    'normalized_short_name': normalized_short,
                    'matched_permutation': perm,
                    'word_reorder': perm != normalized_short
                }

    return None

def main():
    """Main matching function"""
    print('🔄 Flexible Word Order Matching for MMLU Scores')
    print('=' * 55)

    # Load datasets
    benchmark_models, api_models = load_datasets()
    benchmark_names = create_benchmark_lookup(benchmark_models)

    print(f'Loaded {len(benchmark_models)} benchmark models')
    print(f'Loaded {len(api_models)} API models')

    # Reset any existing MMLU matches for clean run
    for api_model in api_models:
        if 'evaluations' in api_model:
            api_model['evaluations'] = {k: v for k, v in api_model['evaluations'].items()
                                      if not k.startswith('mmlu_pro')}

    # Run matching
    matches = []
    for api_model in api_models:
        match = flexible_order_match(api_model, benchmark_names)
        if match:
            # Add MMLU score to API model
            if 'evaluations' not in api_model:
                api_model['evaluations'] = {}

            api_model['evaluations']['mmlu_pro'] = match['mmlu_score']
            api_model['evaluations']['mmlu_pro_source'] = 'flexible_word_order_match'

            matches.append(match)

    # Results
    direct_matches = sum(1 for m in matches if not m['word_reorder'])
    reordered_matches = sum(1 for m in matches if m['word_reorder'])

    print(f'\\n✅ Found {len(matches)} total matches')
    print(f'  Direct matches (no reordering): {direct_matches}')
    print(f'  Word order reordered matches: {reordered_matches}')
    print(f'  Coverage: {len(matches)}/{len(api_models)} ({len(matches)/len(api_models):.1%})')

    # Export detailed matches
    with open('flexible_word_order_matches_detailed.json', 'w') as f:
        json.dump(matches, f, indent=2)

    # Save updated API models
    with open('model-scores.json', 'w') as f:
        json.dump(api_models, f, indent=2)

    print('\\n💾 Files saved:')
    print('  • model-scores.json - Updated with MMLU scores')
    print('  • flexible_word_order_matches_detailed.json - Match details')

    # Show examples
    if matches:
        print('\\n🎯 Examples of matches:')
        reordered_examples = [m for m in matches if m['word_reorder']][:3]
        for i, match in enumerate(reordered_examples, 1):
            orig_name = match['original_short_name']
            perm = match['matched_permutation']
            bench_name = match['benchmark_model']['name']
            score = match['mmlu_score']
            print(f'{i}. "{orig_name}" → "{perm}"')
            print(f'   Benchmark: "{bench_name}" (MMLU: {score})')

if __name__ == '__main__':
    main()
