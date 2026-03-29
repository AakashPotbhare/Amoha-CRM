import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Pencil, Plus, Settings, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
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
  address: string | null;
  latitude: number | string;
  longitude: number | string;
  radius_meters: number;
  is_active: boolean;
}

const defaultShift = {
  id: null as string | null,
  name: "",
  start_time: "09:00",
  end_time: "18:00",
  grace_period_minutes: 15,
  required_hours: 8,
  max_late_per_month: 3,
  is_active: true,
};

const defaultLocation = {
  id: null as string | null,
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_meters: 200,
  is_active: true,
};

function normalizeTime(value: string) {
  return value?.slice(0, 5) ?? "";
}

export default function ShiftManagement() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [shifts, setShifts] = useState<ShiftSetting[]>([]);
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [shiftForm, setShiftForm] = useState({ ...defaultShift });
  const [locationForm, setLocationForm] = useState({ ...defaultLocation });
  const [loading, setLoading] = useState(true);
  const [savingShift, setSavingShift] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canManage = employee && ["director", "ops_head", "hr_head"].includes(employee.role);

  useEffect(() => {
    void fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [shiftsRes, locationsRes] = await Promise.all([
        api.get<ShiftSetting[]>("/api/hr/shifts"),
        api.get<OfficeLocation[]>("/api/hr/office-locations"),
      ]);
      setShifts(shiftsRes.data ?? []);
      setLocations(locationsRes.data ?? []);
    } catch (err: any) {
      toast({ title: "Failed to load shift settings", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetShiftForm() {
    setShiftForm({ ...defaultShift });
  }

  function resetLocationForm() {
    setLocationForm({ ...defaultLocation });
  }

  function editShift(shift: ShiftSetting) {
    setShiftForm({
      id: shift.id,
      name: shift.name,
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
      grace_period_minutes: Number(shift.grace_period_minutes),
      required_hours: Number(shift.required_hours),
      max_late_per_month: Number(shift.max_late_per_month),
      is_active: !!shift.is_active,
    });
  }

  function editLocation(location: OfficeLocation) {
    setLocationForm({
      id: location.id,
      name: location.name,
      address: location.address ?? "",
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      radius_meters: Number(location.radius_meters),
      is_active: !!location.is_active,
    });
  }

  async function saveShift() {
    if (!shiftForm.name.trim()) return;
    setSavingShift(true);
    try {
      const payload = {
        name: shiftForm.name.trim(),
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        grace_period_minutes: Number(shiftForm.grace_period_minutes),
        required_hours: Number(shiftForm.required_hours),
        max_late_per_month: Number(shiftForm.max_late_per_month),
        is_active: shiftForm.is_active,
      };

      if (shiftForm.id) {
        await api.patch(`/api/hr/shifts/${shiftForm.id}`, payload);
        toast({ title: "Shift updated" });
      } else {
        await api.post("/api/hr/shifts", payload);
        toast({ title: "Shift created" });
      }

      resetShiftForm();
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to save shift", description: err.message, variant: "destructive" });
    } finally {
      setSavingShift(false);
    }
  }

  async function saveLocation() {
    if (!locationForm.name.trim() || !locationForm.latitude || !locationForm.longitude) {
      toast({
        title: "Missing fields",
        description: "Name, latitude, and longitude are required.",
        variant: "destructive",
      });
      return;
    }

    setSavingLocation(true);
    try {
      const payload = {
        name: locationForm.name.trim(),
        address: locationForm.address.trim() || null,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        radius_meters: Number(locationForm.radius_meters),
        is_active: locationForm.is_active,
      };

      if (locationForm.id) {
        await api.patch(`/api/hr/office-locations/${locationForm.id}`, payload);
        toast({ title: "Office location updated" });
      } else {
        await api.post("/api/hr/office-locations", payload);
        toast({ title: "Office location created" });
      }

      resetLocationForm();
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to save location", description: err.message, variant: "destructive" });
    } finally {
      setSavingLocation(false);
    }
  }

  async function toggleShiftActive(shift: ShiftSetting) {
    setBusyKey(`shift-toggle-${shift.id}`);
    try {
      await api.patch(`/api/hr/shifts/${shift.id}`, { is_active: !shift.is_active });
      toast({ title: shift.is_active ? "Shift marked inactive" : "Shift activated" });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to update shift status", description: err.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteShift(shift: ShiftSetting) {
    setBusyKey(`shift-delete-${shift.id}`);
    try {
      await api.delete(`/api/hr/shifts/${shift.id}`);
      if (shiftForm.id === shift.id) resetShiftForm();
      toast({ title: "Shift deleted" });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to delete shift", description: err.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleLocationActive(location: OfficeLocation) {
    setBusyKey(`location-toggle-${location.id}`);
    try {
      await api.patch(`/api/hr/office-locations/${location.id}`, { is_active: !location.is_active });
      toast({ title: location.is_active ? "Location marked inactive" : "Location activated" });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to update location status", description: err.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteLocation(location: OfficeLocation) {
    setBusyKey(`location-delete-${location.id}`);
    try {
      await api.delete(`/api/hr/office-locations/${location.id}`);
      if (locationForm.id === location.id) resetLocationForm();
      toast({ title: "Office location deleted" });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Failed to delete location", description: err.message, variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  }

  if (!canManage) {
    return <Navigate to="/attendance" replace />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Shift & Attendance Management</h1>
          <p className="text-sm text-muted-foreground">Manage active shifts and office locations used by attendance.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              {shiftForm.id ? "Edit Shift" : "Create Shift"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Shift Name</Label>
              <Input value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Grace (mins)</Label>
                <Input type="number" value={shiftForm.grace_period_minutes} onChange={(e) => setShiftForm({ ...shiftForm, grace_period_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Required Hrs</Label>
                <Input type="number" step="0.5" value={shiftForm.required_hours} onChange={(e) => setShiftForm({ ...shiftForm, required_hours: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Max Late/Month</Label>
                <Input type="number" value={shiftForm.max_late_per_month} onChange={(e) => setShiftForm({ ...shiftForm, max_late_per_month: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active for attendance</p>
                <p className="text-xs text-muted-foreground">Only one shift should be active at a time.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShiftForm({ ...shiftForm, is_active: !shiftForm.is_active })}>
                {shiftForm.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveShift} disabled={savingShift || !shiftForm.name.trim()} className="flex-1 gap-2">
                {savingShift ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {shiftForm.id ? "Update Shift" : "Save Shift"}
              </Button>
              {shiftForm.id && (
                <Button variant="outline" onClick={resetShiftForm} className="gap-2">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {locationForm.id ? "Edit Office Location" : "Add Office Location"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Location Name</Label>
              <Input value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={locationForm.address} onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={locationForm.latitude} onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })} />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={locationForm.longitude} onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Geo-fence Radius (meters)</Label>
              <Input type="number" value={locationForm.radius_meters} onChange={(e) => setLocationForm({ ...locationForm, radius_meters: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active for attendance</p>
                <p className="text-xs text-muted-foreground">Only active locations are used in geo-fence checks.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLocationForm({ ...locationForm, is_active: !locationForm.is_active })}>
                {locationForm.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveLocation} disabled={savingLocation || !locationForm.name.trim()} variant="outline" className="flex-1 gap-2">
                {savingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {locationForm.id ? "Update Location" : "Add Location"}
              </Button>
              {locationForm.id && (
                <Button variant="outline" onClick={resetLocationForm} className="gap-2">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Shift History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading shifts...</TableCell>
                  </TableRow>
                ) : shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No shifts configured yet</TableCell>
                  </TableRow>
                ) : (
                  shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell>{shift.start_time}</TableCell>
                      <TableCell>{shift.end_time}</TableCell>
                      <TableCell>
                        <Badge variant={shift.is_active ? "default" : "secondary"}>
                          {shift.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => editShift(shift)} title="Edit shift">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleShiftActive(shift)} disabled={busyKey === `shift-toggle-${shift.id}`} title={shift.is_active ? "Deactivate shift" : "Activate shift"}>
                            {busyKey === `shift-toggle-${shift.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : shift.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteShift(shift)} disabled={busyKey === `shift-delete-${shift.id}`} title="Delete shift">
                            {busyKey === `shift-delete-${shift.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Saved Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-center py-6 text-muted-foreground">Loading locations...</p>
            ) : locations.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">No office locations added yet</p>
            ) : (
              locations.map((location) => (
                <div key={location.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{location.name}</p>
                      {location.address && <p className="text-xs text-muted-foreground">{location.address}</p>}
                    </div>
                    <Badge variant={location.is_active ? "default" : "secondary"}>
                      {location.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {location.latitude}, {location.longitude} · Radius: {location.radius_meters}m
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => editLocation(location)} title="Edit location">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleLocationActive(location)} disabled={busyKey === `location-toggle-${location.id}`} title={location.is_active ? "Deactivate location" : "Activate location"}>
                      {busyKey === `location-toggle-${location.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : location.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteLocation(location)} disabled={busyKey === `location-delete-${location.id}`} title="Delete location">
                      {busyKey === `location-delete-${location.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
