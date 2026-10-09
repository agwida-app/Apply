export function lastNDays(n: number) {
  const days: Date[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) days.push(new Date(today.getTime() - i * 86400e3));
  return days;
}

export function bucketByDay(rows: { createdAt: Date }[], days: Date[]) {
  const fmt = new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" });
  return days.map((d) => {
    const end = d.getTime() + 86400e3;
    return { day: fmt.format(d), count: rows.filter((r) => r.createdAt.getTime() >= d.getTime() && r.createdAt.getTime() < end).length };
  });
}
