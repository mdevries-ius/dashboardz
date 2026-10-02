export function addSalesMonthAllocations(rows, weightRows, fields) {
  const sourceByMonth = new Map(rows.map((row) => [row.date, row]));
  const weightsBySalesMonth = new Map();
  weightRows.forEach((weight) => {
    const entries = weightsBySalesMonth.get(weight.sales_date_month) ?? [];
    entries.push({ calendarMonth: weight.calendar_month, weight: Number(weight.allocation_weight) });
    weightsBySalesMonth.set(weight.sales_date_month, entries);
  });

  return rows.map((row) => {
    const allocations = weightsBySalesMonth.get(row.date) ?? [];
    const aligned = { ...row };
    fields.forEach((field) => {
      let total = 0;
      let complete = allocations.length > 0;
      allocations.forEach(({ calendarMonth, weight }) => {
        const value = sourceByMonth.get(calendarMonth)?.[field];
        if (!Number.isFinite(value)) complete = false;
        else total += value * weight;
      });
      aligned[`${field}_sales_month`] = complete ? total : null;
    });
    return aligned;
  });
}
