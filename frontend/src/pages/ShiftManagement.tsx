import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plus, MapPin, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface ShiftSetting {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  required_hours: number;
  max_late_per_month: number;
  is_active: boolean;
}

interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

const defaultShift = {
  name: "",
  start_time: "19:30",
  end_time: "04:30",
  grace_period_minutes: 15,
  required_hours: 7.5,
  max_late_per_month: 3,
};

const defaultLocation = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_meters: 200,
};

export default function ShiftManagement() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [shifts, setShifts]       = useState<ShiftSetting[]>([]);
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [editShift, setEditShift] = useState({ ...defaultShift });
  const [editLoc, setEditLoc]     = useState({ ...defaultLocation });
  const [savingShift, setSavingShift] = useState(false);
  const [savingLoc, setSavingLoc]     = useState(false);

  const isAdmin = employee && (employee.role === "director" || employee.role === "ops_head");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [shiftsRes, locsRes] = await Promise.all([
        api.get<ShiftSetting[]>("/api/hr/shifts"),
        api.get<OfficeLocation[]>("/api/hr/office-locations"),
      ]);
      if (shiftsRes.success && shiftsRes.data)  setShifts(shiftsRes.data);
      if (locsRes.success && locsRes.data)      setLocations(locsRes.data);
    } catch (err: any) {
      console.error("fetchAll error:", err);
    }
  };

  if (!isAdmin) return <Navigate to="/attendance" replace />;

  const handleSaveShift = async () => {
    if (!editShift.name) return;
    setSavingShift(true);
    try {
      await api.post("/api/hr/shifts", {
        name:                 editShift.name,
        start_time:           editShift.start_time,
        end_time:             editShift.end_time,
        grace_period_minutes: editShift.grace_period_minutes,
        required_hours:       editShift.required_hours,
        max_late_per_month:   editShift.max_late_per_month,
      });
      toast({ title: "Shift saved successfully" });
      setEditShift({ ...defaultShift });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to save shift", description: err.message, variant: "destructive" });
    }
    setSavingShift(false);
  };

  const handleSaveLocation = async () => {
    if (!editLoc.name || !editLoc.latitude || !editLoc.longitude) {
      toast({ title: "Missing fields", description: "Name, latitude, and longitude are required.", variant: "destructive" });
      return;
    }
    setSavingLoc(true);
    try {
      await api.post("/api/hr/office-locations", {
        name:          editLoc.name,
        address:       editLoc.address || undefined,
        latitude:      parseFloat(editLoc.latitude as string),
        longitude:     parseFloat(editLoc.longitude as string),
        radius_meters: Number(editLoc.radius_meters),
      });
      toast({ title: "Office location added" });
      setEditLoc({ ...defaultLocation });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to add location", description: err.message, variant: "destructive" });
    }
    setSavingLoc(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shift & Attendance Management</h1>
        <p className="text-sm text-muted-foreground">Configure shifts, manage office locations, and monitor attendance</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Create Shift ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Create / Update Shift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Shift Name</Label>
              <Input
                value={editShift.name}
                onChange={(e) => setEditShift({ ...editShift, name: e.target.value })}
                placeholder="e.g. Night Shift"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time (IST)</Label>
                <Input
                  type="time"
                  value={editShift.start_time}
                  onChange={(e) => setEditShift({ ...editShift, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time (IST)</Label>
                <Input
                  type="time"
                  value={editShift.end_time}
                  onChange={(e) => setEditShift({ ...editShift, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Grace (mins)</Label>
                <Input
                  type="number"
                  value={editShift.grace_period_minutes}
                  onChange={(e) => setEditShift({ ...editShift, grace_period_minutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Required Hrs</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editShift.required_hours}
                  onChange={(e) => setEditShift({ ...editShift, required_hours: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Max Late/Month</Label>
                <Input
                  type="number"
                  value={editShift.max_late_per_month}
                  onChange={(e) => setEditShift({ ...editShift, max_late_per_month: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button
              onClick={handleSaveShift}
              disabled={savingShift || !editShift.name}
              className="w-full gap-2"
            >
              {savingShift ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save & Activate Shift
            </Button>
          </CardContent>
        </Card>

        {/* ── Add Office Location ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Add Office Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Location Name</Label>
              <Input
                value={editLoc.name}
                onChange={(e) => setEditLoc({ ...editLoc, name: e.target.value })}
                placeholder="e.g. Head Office"
              />
            </div>
            <div>
              <Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={editLoc.address}
                onChange={(e) => setEditLoc({ ...editLoc, address: e.target.value })}
                placeholder="123, MG Road, Bengaluru"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.0000001"
                  value={editLoc.latitude}
                  onChange={(e) => setEditLoc({ ...editLoc, latitude: e.target.value })}
                  placeholder="12.9716"
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.0000001"
                  value={editLoc.longitude}
                  onChange={(e) => setEditLoc({ ...editLoc, longitude: e.target.value })}
                  placeholder="77.5946"
                />
              </div>
            </div>
            <div>
              <Label>Geo-fence Radius (meters)</Label>
              <Input
                type="number"
                value={editLoc.radius_meters}
                onChange={(e) => setEditLoc({ ...editLoc, radius_meters: Number(e.target.value) })}
                placeholder="200"
              />
            </div>
            <Button
              onClick={handleSaveLocation}
              disabled={savingLoc || !editLoc.name}
              className="w-full gap-2"
              variant="outline"
            >
              {savingLoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Location
            </Button>

            {/* Existing locations */}
            {locations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved Locations</p>
                {locations.map((loc) => (
                  <div key={loc.id} className="p-3 border border-border rounded-lg text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{loc.name}</p>
                      <Badge variant={loc.is_active ? "default" : "secondary"}>
                        {loc.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {loc.address && <p className="text-muted-foreground text-xs">{loc.address}</p>}
                    <p className="text-xs text-muted-foreground">
                      {loc.latitude}, {loc.longitude} · Radius: {loc.radius_meters}m
                    </p>
                  </div>
                ))}
              </div>
            )}

            {locations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No office locations added yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Shift History ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Shift History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Grace</TableHead>
                <TableHead>Req Hrs</TableHead>
                <TableHead>Max Late</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.start_time}</TableCell>
                  <TableCell>{s.end_time}</TableCell>
                  <TableCell>{s.grace_period_minutes}m</TableCell>
                  <TableCell>{s.required_hours}h</TableCell>
                  <TableCell>{s.max_late_per_month}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">No shifts configured yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
