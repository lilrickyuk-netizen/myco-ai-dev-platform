import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import config from "../config";

export default function Support() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none">
            <div className="text-center py-12 text-muted-foreground">
              <h2 className="text-xl font-semibold mb-4">Need Help?</h2>
              <p className="mb-4">
                Contact us at{" "}
                <span className="font-mono bg-muted px-2 py-1 rounded">
                  {config.supportEmail || "INSERT_SUPPORT_EMAIL"}
                </span>
              </p>
              <p className="text-sm">
                We're here to help you get the most out of the MYCO Platform.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}