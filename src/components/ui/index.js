// src/components/ui/index.js
//
// The "Ledger and Rail" primitives. Pages compose from these; they do
// not invent their own containers, headings or number formatting.

export { default as PageHeader }       from './PageHeader';
export { default as Toolbar }          from './Toolbar';
export { default as Section }          from './Section';
export { default as MetricRail }       from './MetricRail';
export { Metric }                      from './MetricRail';
export { default as DataTable }        from './DataTable';
export { default as StatementBlock }   from './StatementBlock';
export { StatementRow, StatementResult } from './StatementBlock';
export { default as StatusPill }       from './StatusPill';
export { default as FormField }        from './FormField';
export { default as SegmentedControl } from './SegmentedControl';
export { default as EmptyState }       from './EmptyState';
export { default as Skeleton }         from './Skeleton';
export { SkeletonRows }                from './Skeleton';
export { default as Money }            from './Money';
export { amountOnly, CURRENCY }        from './format';
