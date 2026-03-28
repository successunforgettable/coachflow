import { trpc } from "@/lib/trpc";

export default function AdminAnalytics() {
  const { data: engagement } = trpc.admin.getEngagementMetrics.useQuery();
  const { data: dropOff } = trpc.admin.getNodeDropOff.useQuery();

  const s = (label: string, value: string) => (
    <div style={{ background: "#fff", borderRadius: 24, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", flex: 1, minWidth: 140 }}>
      <p style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 28, color: "#FF5B1D", margin: 0, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", margin: "8px 0 0" }}>{label}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 28, color: "#1A1624", margin: "0 0 8px" }}>Analytics</h1>
      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: "#999", margin: "0 0 28px" }}>User engagement and campaign path drop-off analysis</p>

      {/* Engagement */}
      {engagement && (
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          {s("DAU", String(engagement.dau))}
          {s("WAU", String(engagement.wau))}
          {s("Avg Nodes/Kit", String(engagement.avgNodes))}
          {s("Kit Completion", `${engagement.completionRate}%`)}
          {s("Activation Rate", `${engagement.activationRate}%`)}
        </div>
      )}

      {/* Node Drop-Off Table */}
      <div style={{ background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "20px 24px 12px" }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 900, fontSize: 18, color: "#1A1624", margin: 0 }}>Campaign Path Drop-Off</h3>
          <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: "#999", margin: "4px 0 0" }}>Where users abandon the guided campaign path</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf8f5" }}>
              <th style={{ padding: "12px 24px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Node</th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Users Completed</th>
              <th style={{ padding: "12px 24px", textAlign: "left", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999", width: "40%" }}>Completion</th>
              <th style={{ padding: "12px 24px", textAlign: "right", fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#999" }}>Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {dropOff?.map((node: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <td style={{ padding: "14px 24px", fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1624" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "#FF5B1D", color: "#fff", fontSize: 10, fontWeight: 700, marginRight: 8 }}>{i + 3}</span>
                  {node.name}
                </td>
                <td style={{ padding: "14px 24px", fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: "#666" }}>
                  {node.completed} / {node.total}
                </td>
                <td style={{ padding: "14px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#f0ece5", overflow: "hidden" }}>
                      <div style={{ width: `${node.percentage}%`, height: "100%", borderRadius: 4, background: node.percentage > 50 ? "#FF5B1D" : "#EAB308", transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: "#999", minWidth: 40, textAlign: "right" }}>{node.percentage}%</span>
                  </div>
                </td>
                <td style={{ padding: "14px 24px", textAlign: "right", fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, fontWeight: 600, color: node.dropOff > 20 ? "#C0390A" : "#999" }}>
                  {node.dropOff > 0 ? `-${node.dropOff}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
