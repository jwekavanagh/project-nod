import { PRICING_FEATURE_COMPARISON } from "@/content/marketingContracts";

export function PricingCompareTable() {
  const compare = PRICING_FEATURE_COMPARISON;
  return (
    <section
      className="pricing-compare"
      aria-labelledby="pricing-compare-title"
      data-testid="pricing-compare-section"
    >
      <h2 id="pricing-compare-title" className="pricing-compare-heading">
        {compare.title}
      </h2>
      <div className="pricing-compare-scroll">
        <table className="pricing-compare-table">
          <thead>
            <tr>
              {compare.columnLabels.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compare.rows.map((row) => (
              <tr key={row.feature}>
                <th scope="row">{row.feature}</th>
                <td>{row.starter}</td>
                <td>{row.individual}</td>
                <td>{row.team}</td>
                <td>{row.business}</td>
                <td>{row.enterprise}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
