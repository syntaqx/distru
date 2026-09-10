import { VehicleForm } from "@/components/fleet/vehicle-form";

export const dynamic = "force-dynamic";

export default function NewVehiclePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <VehicleForm initial={{ name: "", make: "", model: "", licensePlate: "" }} />
      </div>
    </div>
  );
}
