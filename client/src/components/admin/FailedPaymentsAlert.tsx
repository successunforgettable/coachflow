import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FailedPaymentsAlert() {
  const { data: failedPayments, isLoading } = trpc.admin.getFailedPayments.useQuery();

  if (isLoading) {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Failed Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!failedPayments || failedPayments.length === 0) {
    return null; // Don't show if no failed payments
  }

  return (
    <Card className="border-red-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          {failedPayments.length} Failed Payment{failedPayments.length > 1 ? "s" : ""} Requiring Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {failedPayments.map((payment) => (
            <div
              key={payment.userId}
              className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium">{payment.name || payment.email}</div>
                <div className="text-sm text-muted-foreground">{payment.email}</div>
                <div className="text-sm text-red-600 font-medium mt-1">
                  ${payment.amount.toFixed(2)} due on {new Date(payment.dueDate).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open Stripe invoice in new tab
                    window.open(`https://dashboard.stripe.com/invoices/${payment.invoiceId}`, "_blank");
                  }}
                >
                  View Invoice
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement send payment reminder
                    alert("Send payment reminder feature coming soon");
                  }}
                >
                  Send Reminder
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
