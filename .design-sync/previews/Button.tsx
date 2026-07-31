import { Button } from "teams-mile-warshaw";

export function Intents() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button intent="primary">Register a team</Button>
      <Button intent="dark">View start list</Button>
      <Button intent="ghost">See the rules</Button>
      <Button intent="link">Read the full regulations</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button intent="primary" size="sm">
        Small
      </Button>
      <Button intent="primary" size="md">
        Medium
      </Button>
      <Button intent="primary" size="lg">
        Large
      </Button>
    </div>
  );
}

export function OnDarkSurface() {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-ink p-6">
      <Button intent="primary">Register a team</Button>
      <Button intent="ghostLight">Watch the film</Button>
    </div>
  );
}

export function FullWidthAndDisabled() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Button intent="primary" block>
        Continue to payment
      </Button>
      <Button intent="dark" block>
        Save for later
      </Button>
      <Button intent="primary" block disabled>
        Sold out
      </Button>
    </div>
  );
}
