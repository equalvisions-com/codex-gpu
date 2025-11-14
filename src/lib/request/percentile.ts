export type Percentile = 50 | 75 | 90 | 95 | 99;

export function calculatePercentile(values: number[], value: number) {
  if (!values.length) return 0;
  const sortedValues = values.slice().sort((a, b) => a - b);
  const rank = sortedValues.filter((val) => val <= value).length;
  return (rank / sortedValues.length) * 100;
}
