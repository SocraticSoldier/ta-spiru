import type { VehicleSizeName } from './types';

/**
 * Make and model to wash size.
 *
 * Wash prices are banded by size, and asking a customer to judge whether their
 * car is "medium" invites a wrong answer and an argument at the bay. Picking
 * the make and model instead is something anyone can do, and it lands on the
 * same band every time.
 *
 * Weighted to what actually drives around Malta — a lot of Japanese imports
 * alongside the usual European hatchbacks. Anything not listed falls back to
 * MEDIUM and the customer can correct it; the attendant has the final say at
 * the bay either way.
 */
export interface VehicleModelSpec {
  model: string;
  size: VehicleSizeName;
}

export interface VehicleMakeSpec {
  make: string;
  models: readonly VehicleModelSpec[];
}

const S: VehicleSizeName = 'SMALL';
const M: VehicleSizeName = 'MEDIUM';
const L: VehicleSizeName = 'LARGE';

export const VEHICLE_CATALOGUE: readonly VehicleMakeSpec[] = [
  {
    make: 'Toyota',
    models: [
      { model: 'Aygo', size: S },
      { model: 'Yaris', size: S },
      { model: 'Corolla', size: M },
      { model: 'C-HR', size: M },
      { model: 'Auris', size: M },
      { model: 'Avensis', size: M },
      { model: 'RAV4', size: L },
      { model: 'Land Cruiser', size: L },
      { model: 'Hilux', size: L },
      { model: 'Proace', size: L },
    ],
  },
  {
    make: 'Volkswagen',
    models: [
      { model: 'Up', size: S },
      { model: 'Polo', size: S },
      { model: 'Golf', size: M },
      { model: 'Jetta', size: M },
      { model: 'Passat', size: M },
      { model: 'T-Roc', size: M },
      { model: 'Tiguan', size: L },
      { model: 'Touareg', size: L },
      { model: 'Transporter', size: L },
      { model: 'Caddy', size: L },
    ],
  },
  {
    make: 'Nissan',
    models: [
      { model: 'Micra', size: S },
      { model: 'Note', size: S },
      { model: 'Juke', size: M },
      { model: 'Qashqai', size: M },
      { model: 'Leaf', size: M },
      { model: 'X-Trail', size: L },
      { model: 'Navara', size: L },
      { model: 'NV200', size: L },
    ],
  },
  {
    make: 'Honda',
    models: [
      { model: 'Jazz', size: S },
      { model: 'Civic', size: M },
      { model: 'Accord', size: M },
      { model: 'HR-V', size: M },
      { model: 'CR-V', size: L },
    ],
  },
  {
    make: 'Mazda',
    models: [
      { model: 'Mazda2', size: S },
      { model: 'Demio', size: S },
      { model: 'Mazda3', size: M },
      { model: 'Mazda6', size: M },
      { model: 'CX-3', size: M },
      { model: 'CX-5', size: L },
      { model: 'CX-60', size: L },
    ],
  },
  {
    make: 'Suzuki',
    models: [
      { model: 'Alto', size: S },
      { model: 'Celerio', size: S },
      { model: 'Swift', size: S },
      { model: 'Ignis', size: S },
      { model: 'Vitara', size: M },
      { model: 'S-Cross', size: M },
      { model: 'Jimny', size: M },
    ],
  },
  {
    make: 'Ford',
    models: [
      { model: 'Ka', size: S },
      { model: 'Fiesta', size: S },
      { model: 'Focus', size: M },
      { model: 'Mondeo', size: M },
      { model: 'Puma', size: M },
      { model: 'Kuga', size: L },
      { model: 'Transit', size: L },
      { model: 'Ranger', size: L },
    ],
  },
  {
    make: 'Peugeot',
    models: [
      { model: '108', size: S },
      { model: '208', size: S },
      { model: '308', size: M },
      { model: '2008', size: M },
      { model: '3008', size: L },
      { model: '5008', size: L },
      { model: 'Partner', size: L },
    ],
  },
  {
    make: 'Renault',
    models: [
      { model: 'Twingo', size: S },
      { model: 'Clio', size: S },
      { model: 'Megane', size: M },
      { model: 'Captur', size: M },
      { model: 'Kadjar', size: M },
      { model: 'Koleos', size: L },
      { model: 'Trafic', size: L },
      { model: 'Kangoo', size: L },
    ],
  },
  {
    make: 'Fiat',
    models: [
      { model: 'Panda', size: S },
      { model: '500', size: S },
      { model: 'Punto', size: S },
      { model: 'Tipo', size: M },
      { model: '500X', size: M },
      { model: 'Doblo', size: L },
      { model: 'Ducato', size: L },
    ],
  },
  {
    make: 'Opel',
    models: [
      { model: 'Corsa', size: S },
      { model: 'Adam', size: S },
      { model: 'Astra', size: M },
      { model: 'Insignia', size: M },
      { model: 'Mokka', size: M },
      { model: 'Grandland', size: L },
      { model: 'Vivaro', size: L },
    ],
  },
  {
    make: 'BMW',
    models: [
      { model: '1 Series', size: M },
      { model: '2 Series', size: M },
      { model: '3 Series', size: M },
      { model: '5 Series', size: M },
      { model: 'X1', size: M },
      { model: 'X3', size: L },
      { model: 'X5', size: L },
      { model: 'X7', size: L },
    ],
  },
  {
    make: 'Mercedes-Benz',
    models: [
      { model: 'A-Class', size: M },
      { model: 'C-Class', size: M },
      { model: 'E-Class', size: M },
      { model: 'CLA', size: M },
      { model: 'GLA', size: M },
      { model: 'GLC', size: L },
      { model: 'GLE', size: L },
      { model: 'Vito', size: L },
      { model: 'Sprinter', size: L },
    ],
  },
  {
    make: 'Audi',
    models: [
      { model: 'A1', size: S },
      { model: 'A3', size: M },
      { model: 'A4', size: M },
      { model: 'A6', size: M },
      { model: 'Q2', size: M },
      { model: 'Q3', size: M },
      { model: 'Q5', size: L },
      { model: 'Q7', size: L },
    ],
  },
  {
    make: 'Hyundai',
    models: [
      { model: 'i10', size: S },
      { model: 'i20', size: S },
      { model: 'i30', size: M },
      { model: 'Kona', size: M },
      { model: 'Tucson', size: L },
      { model: 'Santa Fe', size: L },
    ],
  },
  {
    make: 'Kia',
    models: [
      { model: 'Picanto', size: S },
      { model: 'Rio', size: S },
      { model: 'Ceed', size: M },
      { model: 'Stonic', size: M },
      { model: 'Niro', size: M },
      { model: 'Sportage', size: L },
      { model: 'Sorento', size: L },
    ],
  },
  {
    make: 'Citroën',
    models: [
      { model: 'C1', size: S },
      { model: 'C3', size: S },
      { model: 'C4', size: M },
      { model: 'C3 Aircross', size: M },
      { model: 'C5 Aircross', size: L },
      { model: 'Berlingo', size: L },
    ],
  },
  {
    make: 'Škoda',
    models: [
      { model: 'Citigo', size: S },
      { model: 'Fabia', size: S },
      { model: 'Octavia', size: M },
      { model: 'Scala', size: M },
      { model: 'Karoq', size: M },
      { model: 'Superb', size: M },
      { model: 'Kodiaq', size: L },
    ],
  },
  {
    make: 'Mini',
    models: [
      { model: 'Cooper', size: S },
      { model: 'Clubman', size: M },
      { model: 'Countryman', size: M },
    ],
  },
  {
    make: 'Tesla',
    models: [
      { model: 'Model 3', size: M },
      { model: 'Model Y', size: L },
      { model: 'Model S', size: L },
      { model: 'Model X', size: L },
    ],
  },
  {
    make: 'Land Rover',
    models: [
      { model: 'Defender', size: L },
      { model: 'Discovery', size: L },
      { model: 'Range Rover', size: L },
      { model: 'Range Rover Evoque', size: M },
    ],
  },
  {
    make: 'Jeep',
    models: [
      { model: 'Renegade', size: M },
      { model: 'Compass', size: L },
      { model: 'Wrangler', size: L },
    ],
  },
  {
    make: 'Volvo',
    models: [
      { model: 'V40', size: M },
      { model: 'S60', size: M },
      { model: 'XC40', size: M },
      { model: 'XC60', size: L },
      { model: 'XC90', size: L },
    ],
  },
  {
    make: 'SEAT',
    models: [
      { model: 'Mii', size: S },
      { model: 'Ibiza', size: S },
      { model: 'Leon', size: M },
      { model: 'Arona', size: M },
      { model: 'Ateca', size: M },
      { model: 'Tarraco', size: L },
    ],
  },
];

/** Every make, alphabetical — the first dropdown. */
export const vehicleMakes = (): string[] => VEHICLE_CATALOGUE.map((entry) => entry.make);

/** The models for one make — the second dropdown. Empty for an unknown make. */
export const vehicleModels = (make: string): readonly VehicleModelSpec[] =>
  VEHICLE_CATALOGUE.find((entry) => entry.make.toLowerCase() === make.trim().toLowerCase())?.models ?? [];

/**
 * The wash size for a make and model.
 *
 * Falls back to MEDIUM for anything unlisted rather than refusing the booking —
 * a customer with an unusual car should still be able to book, and both they
 * and the attendant can correct the size.
 */
export const vehicleSizeFor = (make: string, model: string): VehicleSizeName => {
  const found = vehicleModels(make).find(
    (entry) => entry.model.toLowerCase() === model.trim().toLowerCase(),
  );
  return found?.size ?? 'MEDIUM';
};

export const VEHICLE_SIZE_LABELS: Readonly<Record<VehicleSizeName, string>> = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large / SUV',
};
