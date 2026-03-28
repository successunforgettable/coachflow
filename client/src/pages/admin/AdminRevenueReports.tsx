import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminRevenueReports() {
  const { data: financialMetrics, isLoading } = trpc.admin.getFinancialMetrics.useQuery();

  const statCard = (value: string, label: string) => (
    <div style={{
      background: "#fff",
      borderRadius: 24,
      padding: "24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      flex: 1,
      minWidth: 140,
    }}>
      <p style={{
        fontFamily: "'Fraunces', serif",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: 32,
        color: "#FF5B1D",
        margin: 0,
        lineHeight: 1.1,
      }}>{value}</p>
      <p style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        color: "#999",
        margin: "8px 0 0",
      }}>{label}</p>
    </div>
  );

  const exportRevenueCSV = () => {
    if (!financialMetrics) return;
    const headers = ["Metric", "Value"];
    const rows = [
      ["MRR", `$${financialMetrics.mrr.toLocaleString()}`],
      ["ARR", `$${financialMetrics.arr.toLocaleString()}`],
      ["ARPU", `$${financialMetrics.arpu.toFixed(2)}`],
      ["Total Revenue (Monthly)", `$${financialMetrics.mrr.toLocaleString()}`],
      ["Trial Conversion Rate", `${financialMetrics.trialToProRate}%`],
      ["Churn Rate", `${financialMetrics.churnRate}%`],
      ["Active Subscriptions", String(financialMetrics.activeSubscriptions)],
      ["Churned This Month", String(financialMetrics.churnedThisMonth)],
      ["New MRR (30d)", `$${financialMetrics.newMrrThisMonth.toLocaleString()}`],
    ];
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Revenue report exported to CSV");
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100 }}>
        <p style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#999", padding: 32 }}>Loading revenue data...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: 28,
            color: "#1A1624",
            margin: 0,
          }}>Revenue Reports</h1>
          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: "#999", margin: "4px 0 0" }}>
            Financial metrics and revenue breakdown
          </p>
        </div>
        <button
          onClick={exportRevenueCSV}
          style={{
            padding: "10px 20px",
            borderRadius: 9999,
            border: "none",
            background: "#FF5B1D",
            color: "#fff",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Stat Cards */}
      {financialMetrics && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {statCard(`$${financialMetrics.mrr.toLocaleString()}`, "MRR")}
            {statCard(`$${financialMetrics.arr.toLocaleString()}`, "ARR")}
            {statCard(`$${financialMetrics.arpu.toFixed(2)}`, "ARPU")}
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            {statCard(`$${financialMetrics.mrr.toLocaleString()}`, "Total Revenue (Monthly)")}
            {statCard(`${financialMetrics.trialToProRate}%`, "Trial Conversion Rate")}
            {statCard(`${financialMetrics.churnRate}%`, "Churn Rate")}
          </div>
        </>
      )}

      {/* Additional Details */}
      {financialMetrics && (
        <div style={{ background: "#fff", borderRadius: 24, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: 18,
            color: "#1A1624",
            margin: "0 0 16px",
          }}>Details</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Active Subscriptions", String(financialMetrics.activeSubscriptions)],
                ["Churned This Month", String(financialMetrics.churnedThisMonth)],
                ["New MRR (30d)", `$${financialMetrics.newMrrThisMonth.toLocaleString()}`],
                ["MRR Growth", `${financialMetrics.mrrGrowth}%`],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <td style={{ padding: "12px 0", fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: "#999" }}>{label}</td>
                  <td style={{ padding: "12px 0", fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1624", textAlign: "right" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
