import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, ExternalLink, Loader2, TrendingUp, Building2, Landmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketIntel, type MarketIntelData } from "@/lib/api/marketIntel";
import type { BankInfo } from "@/data/bankData";

interface MarketResearchProps {
  bank: BankInfo;
  peerBanks: BankInfo[];
}

const formatCurrency = (val: number) => {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val}`;
};

const MarketResearch = ({ bank, peerBanks }: MarketResearchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<MarketIntelData | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFetch = async () => {
    setIsLoading(true);
    setStreamingUrl(null);
    try {
      const result = await fetchMarketIntel(bank, peerBanks, (url) => setStreamingUrl(url));
      setData(result);
      toast({ title: "Market Intel Retrieved", description: "Live market data loaded successfully." });
    } catch (err) {
      console.error("Market intel error:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch market intel", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStreamingUrl(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b-2 border-primary pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg text-foreground">Market Research</h3>
        </div>
        <p className="text-sm text-muted-foreground">Competitive rate intelligence for {bank.name}</p>
      </div>

      {/* Fetch button */}
      {!data && (
        <Card className="p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Retrieve live market intelligence including competitor deposit rates, FDIC market share data, and peer bank pricing.
          </p>
          <Button onClick={handleFetch} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gathering Market Intel…
              </>
            ) : (
              <>
                <Globe className="h-4 w-4" />
                Retrieve Market Intel
              </>
            )}
          </Button>
          {streamingUrl && (
            <p className="text-xs text-muted-foreground">
              <a href={streamingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Watch live extraction →
              </a>
            </p>
          )}
        </Card>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-8">
          {/* Competitor Rates */}
          {data.competitorRates?.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h4 className="font-semibold text-sm">Competitor Deposit Rates</h4>
              </div>
              <Card className="overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="font-semibold">Institution</TableHead>
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="text-right font-semibold">APY (%)</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.competitorRates.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{r.institution}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.product}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-accent">{r.rate}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {r.source}
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          )}

          {/* FDIC Market Share */}
          {data.fdicMarketShare && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" />
                <h4 className="font-semibold text-sm">FDIC Summary of Deposits — Market Share</h4>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-accent tabular-nums">{data.fdicMarketShare.marketSharePct}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Market Share</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(data.fdicMarketShare.totalDeposits)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Deposits</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{data.fdicMarketShare.branches}</p>
                  <p className="text-xs text-muted-foreground mt-1">Branches</p>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground">Market Area: {data.fdicMarketShare.marketArea}</p>

              {data.fdicMarketShare.competitors?.length > 0 && (
                <Card className="overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="font-semibold">Competitor</TableHead>
                        <TableHead className="text-right font-semibold">Deposits</TableHead>
                        <TableHead className="text-right font-semibold">Branches</TableHead>
                        <TableHead className="text-right font-semibold">Market Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.fdicMarketShare.competitors.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{c.name}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{formatCurrency(c.deposits)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{c.branches}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-semibold">{c.marketSharePct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </section>
          )}

          {/* Peer Bank Rates */}
          {data.peerBankRates?.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-accent" />
                <h4 className="font-semibold text-sm">Peer Bank Advertised Rates</h4>
              </div>
              <Card className="overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="font-semibold">Bank</TableHead>
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="text-right font-semibold">APY (%)</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.peerBankRates.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{r.bankName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.product}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-accent">{r.rate}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {r.source}
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          )}

          {/* Refresh */}
          <div className="text-center pt-2">
            <Button variant="outline" size="sm" onClick={handleFetch} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Refresh Market Intel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketResearch;
