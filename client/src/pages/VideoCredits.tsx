import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CreditPurchaseModal } from "../components/CreditPurchaseModal";
import { Coins, ArrowUpRight, ArrowDownRight, Gift, RefreshCw } from "lucide-react";

export function VideoCredits() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const { data: balance, isLoading: balanceLoading } = trpc.videoCredits.getBalance.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.videoCredits.getTransactions.useQuery();

  if (balanceLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Credits</h1>
        <p className="text-muted-foreground">
          Purchase credits to generate AI video ads with voiceover
        </p>
      </div>

      {/* Balance Card */}
      <Card className="p-8 mb-8 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Coins className="w-8 h-8 text-purple-500" />
              <h2 className="text-lg text-muted-foreground">Current Balance</h2>
            </div>
            <div className="text-5xl font-bold text-foreground">
              {balance?.balance || 0}
              <span className="text-2xl text-muted-foreground ml-2">credits</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              1 credit = 15-30s video • 2 credits = 60s video • 3 credits = 90s video
            </p>
          </div>
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => setShowPurchaseModal(true)}
          >
            <Coins className="w-4 h-4 mr-2" />
            Buy Credits
          </Button>
        </div>
      </Card>

      {/* Transaction History */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Transaction History</h2>
        
        {transactionsLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
        ) : transactions && transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Icon based on transaction type */}
                  {tx.type === "purchase" && (
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {tx.type === "deduction" && (
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                      <ArrowDownRight className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                  {tx.type === "free_grant" && (
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                  {tx.type === "refund" && (
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-yellow-500" />
                    </div>
                  )}

                  {/* Transaction details */}
                  <div>
                    <div className="font-medium text-foreground">{tx.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div
                    className={`text-lg font-bold ${
                      tx.amount > 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Balance: {tx.balanceAfter}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Coins className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No transactions yet</p>
            <Button
              variant="outline"
              onClick={() => setShowPurchaseModal(true)}
            >
              Purchase Your First Credits
            </Button>
          </div>
        )}
      </Card>

      {/* Purchase Modal */}
      <CreditPurchaseModal
        open={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
      />
    </div>
  );
}
