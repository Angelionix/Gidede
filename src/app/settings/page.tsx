"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Настройки</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Настройки приложения</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Настройки будут доступны после реализации авторизации (4.A.5)</p>
        </CardContent>
      </Card>
    </div>
  );
}
