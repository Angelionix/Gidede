"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, XCircle, Zap } from "lucide-react";
import type { BalanceObject } from "@/types/balance";

interface ObjectFormProps {
  objects: BalanceObject[];
  onObjectsChange: (objs: BalanceObject[]) => void;
}

export function ObjectForm({ objects, onObjectsChange }: ObjectFormProps) {
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");

  const addAttribute = (objIndex: number) => {
    if (!newAttrKey.trim() || !newAttrVal) return;
    const updated = [...objects];
    updated[objIndex] = {
      ...updated[objIndex],
      attributes: { ...updated[objIndex].attributes, [newAttrKey.trim()]: Number(newAttrVal) },
    };
    onObjectsChange(updated);
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const removeAttribute = (objIndex: number, key: string) => {
    const updated = [...objects];
    const attrs = { ...updated[objIndex].attributes };
    delete attrs[key];
    updated[objIndex] = { ...updated[objIndex], attributes: attrs };
    onObjectsChange(updated);
  };

  const addObject = () => {
    const id = String(objects.length + 1 + Math.random()).slice(0, 8);
    onObjectsChange([
      ...objects,
      { id, name: "", type: "melee", attributes: {}, cost: 100, tier: 1 },
    ]);
  };

  const removeObject = (index: number) => {
    onObjectsChange(objects.filter((_, i) => i !== index));
  };

  const updateObject = (index: number, field: string, value: unknown) => {
    const updated = [...objects];
    updated[index] = { ...updated[index], [field]: value };
    onObjectsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Balance Objects ({objects.length})
        </p>
        <Button variant="outline" size="sm" onClick={addObject}>
          <Zap className="h-3.5 w-3.5 mr-1.5" />
          Add Object
        </Button>
      </div>

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {objects.map((obj, oi) => (
          <Card key={obj.id} className="border-dashed">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Name"
                  value={obj.name}
                  onChange={(e) => updateObject(oi, "name", e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Select
                  value={obj.type}
                  onValueChange={(v) => updateObject(oi, "type", v)}
                >
                  <SelectTrigger className="h-8 text-sm w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="melee">Melee</SelectItem>
                    <SelectItem value="ranged">Ranged</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="tank">Tank</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Cost"
                  value={obj.cost ?? ""}
                  onChange={(e) => updateObject(oi, "cost", Number(e.target.value) || undefined)}
                  className="h-8 text-sm w-20"
                />
                <Input
                  type="number"
                  placeholder="Tier"
                  value={obj.tier ?? ""}
                  onChange={(e) => updateObject(oi, "tier", Number(e.target.value) || undefined)}
                  className="h-8 text-sm w-16"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeObject(oi)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>

              {/* Attributes */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Attributes</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(obj.attributes).map(([key, val]) => (
                    <Badge key={key} variant="outline" className="text-xs pr-1">
                      {key}: {val}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAttribute(oi, key)}
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Key"
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    className="h-7 text-xs w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Value"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    className="h-7 text-xs w-20"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => addAttribute(oi)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
