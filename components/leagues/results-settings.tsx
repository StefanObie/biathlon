"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  regenerateResultsLink,
  setResultsSlug,
  setVisibility,
  type ResultsSettingsResult,
} from "@/lib/results/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Visibility = "public" | "protected" | "private";

const OPTIONS: { value: Visibility; label: string; description: string }[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can see the results, at a readable address.",
  },
  {
    value: "protected",
    label: "Protected",
    description: "Only people you share the Results link with can see them.",
  },
  {
    value: "private",
    label: "Private",
    description: "No one outside the team can see the results.",
  },
];

const BREAKS_LINKS =
  "The current results address will stop working for anyone who has it.";

/**
 * A League's Visibility and Results slug. Anything that breaks an address
 * people may already have asks first, and the database refuses anyone but an
 * Admin whatever this shows.
 */
export function ResultsSettings({
  leagueId,
  visibility,
  slug,
}: {
  leagueId: number;
  visibility: Visibility;
  slug: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(slug ?? "");
  const [savedSlug, setSavedSlug] = useState(slug);
  if (slug !== savedSlug) {
    setSavedSlug(slug);
    setDraft(slug ?? "");
  }

  function run(change: () => Promise<ResultsSettingsResult>, done?: string) {
    startTransition(async () => {
      const { error } = await change();
      if (error) toast.error(error);
      else if (done) toast.success(done);
    });
  }

  async function copyLink() {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/results/${slug}`,
      );
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Results</h2>
        <p className="text-sm text-muted-foreground">
          Visibility decides who can see this league&apos;s published results
          without signing in. Only heats that are Closed are shown. It never
          gives anyone access to captures, notes or the audit log.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {OPTIONS.map((option) => {
          const current = option.value === visibility;
          // Choosing another Visibility replaces the address, so if there
          // is one to lose, ask first.
          const loses = slug !== null;
          const choose = () =>
            run(() => setVisibility(leagueId, option.value), "Saved.");
          return (
            <li
              key={option.value}
              className="flex items-center justify-between gap-3 rounded-md border border-input p-3"
            >
              <div>
                <div className="font-medium">
                  {option.label}
                  {current && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (current)
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {option.description}
                </div>
              </div>
              {!current &&
                (loses ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isPending}>
                        Make {option.label}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Make this league {option.label}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {BREAKS_LINKS}
                          {option.value === "private"
                            ? " Nobody outside the team will be able to see the results."
                            : " It gets a new address."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={choose}>
                          Make {option.label}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={choose}
                  >
                    Make {option.label}
                  </Button>
                ))}
            </li>
          );
        })}
      </ul>

      {visibility === "public" && slug && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="results-slug" className="text-sm font-medium">
            Address
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/results/</span>
            <Input
              id="results-slug"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              autoCapitalize="none"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  disabled={isPending || draft.trim() === "" || draft === slug}
                >
                  Save
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Change the address?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {BREAKS_LINKS} There are no redirects.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run(async () => {
                        const result = await setResultsSlug(leagueId, draft);
                        if (result.slug) setDraft(result.slug);
                        return result;
                      }, "Address saved.")
                    }
                  >
                    Change address
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-sm text-muted-foreground">
            Lowercase letters, digits and single hyphens, 3 to 80 characters.
          </p>
        </form>
      )}

      {visibility === "protected" && slug && (
        <div className="flex flex-col gap-2">
          <label htmlFor="results-link" className="text-sm font-medium">
            Results link
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="results-link"
              readOnly
              value={`/results/${slug}`}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" variant="outline" onClick={copyLink}>
              Copy
            </Button>
          </div>
          <div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  Regenerate link
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate the link?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The old Results link will stop working for everyone who has
                    it. You will need to share the new one.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      run(
                        () => regenerateResultsLink(leagueId),
                        "New link created.",
                      )
                    }
                  >
                    Regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
