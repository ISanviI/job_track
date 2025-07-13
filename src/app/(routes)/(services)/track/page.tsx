"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          browser: "chromium", // default browser
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to scrape the website");
      }
      
      const result = await response.json();
      // console.log("Scraping successful:", result.data);
      
    } catch (error) {
      console.error("Error scraping website:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Track New Company</h1>
          <p className="text-muted-foreground mt-2">
            Enter the career page URL of the company you want to track. We'll monitor it for job updates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Career Page URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://company.com/careers"
              className="w-full"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground">
              Make sure to enter the main careers or jobs page URL of the company.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Start Tracking"}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 