import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export default function Settings() {

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your HR evaluation system preferences.
        </p>
      </div>

      {/* General Settings */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">General</h2>
          <p className="text-sm text-muted-foreground">
            Basic configuration for your organization.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input id="company" placeholder="Your Company" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Notification Email</Label>
            <Input id="email" type="email" placeholder="hr@company.com" />
          </div>
        </div>
      </Card>

      {/* Assessment Settings */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Assessment</h2>
          <p className="text-sm text-muted-foreground">
            Configure how assessments are delivered and scored.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Proctoring</Label>
              <p className="text-sm text-muted-foreground">
                Monitor candidates during assessments
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>AI-Generated Questions</Label>
              <p className="text-sm text-muted-foreground">
                Generate personalized questions based on resume
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Advance Questions</Label>
              <p className="text-sm text-muted-foreground">
                Automatically move to next question after time limit
              </p>
            </div>
            <Switch />
          </div>
        </div>
      </Card>

      {/* API Settings */}
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">API Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Backend integration settings.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">Flask API URL</Label>
            <Input
              id="api-url"
              placeholder="http://localhost:5000"
              defaultValue="http://localhost:5000"
            />
          </div>
        </div>

        <Button>Save Changes</Button>
      </Card>
    </div>
  );
}
