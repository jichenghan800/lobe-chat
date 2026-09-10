export const AUDIT_TABLE_COLUMN_WIDTHS = {
  actions: 80,
  analysis: 180,
  model: 210,
  risk: 180,
  session: 220,
  time: 150,
  user: 190,
} as const;

export const AUDIT_TABLE_MIN_WIDTH = Object.values(AUDIT_TABLE_COLUMN_WIDTHS).reduce(
  (total, width) => total + width,
  0,
);
