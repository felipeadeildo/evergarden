# Formulas

When a query, alert rule or piece of code computes a number, show what it computes as a formula first, and the code in a tab beside it. Name the quantities with short symbols, say what each one is in the sentence after, and leave the label names, units and filters to the code:

````
:::tabs
::tab[Formula]
$$
u = \frac{T_{\text{month}} + \dfrac{T_{7d}}{7}\,(D - d + 1)}{A}
$$

$T_{\text{month}}$ is this month's traffic so far, $T_{7d}$ the last seven days', $D$ the days in
the month, $d$ today and $A$ the allowance. The alert fires when $u > 1$.
::tab[PromQL]
```promql
(
  max(hedy_zone_traffic_bytes{service_name="hedy"})
  + max(hedy_zone_traffic_week_bytes{service_name="hedy"}) / 7
    * (days_in_month() - day_of_month() + 1)
)
/ max(hedy_zone_allowance_bytes{service_name="hedy"})
```
:::
````

Write the formula from the code, not from memory, and keep them saying the same thing: when one changes, change the other. Use `\frac` for division, `\cdot` or a thin space `\,` for products, `\lceil x \rceil` for `ceil`, `\max` and `\sum_{z}` for aggregations, and `\text{…}` for words inside math.
