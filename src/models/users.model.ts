import { Model, ModelObject, Pojo } from "objection";
import { User } from "@/interfaces/users.interface";
import objectionSoftDelete from "objection-js-soft-delete";

const softDelete = objectionSoftDelete({
  columnName: "deletedAt",
  deletedValue: new Date(),
  notDeletedValue: null,
});

export class Users extends softDelete(Model) implements User {
  id!: number;
  username!: string;
  fullName!: string;
  profilePicImageKey!: string;

  phoneNumber!: string; // In formato internazionale, esempio: +393401234567
  phoneNumberOnlyDigits!: string; // Solo cifre, esempio: 3401234567
  phoneNumberCountryIso2!: string | null; // Codice ISO 3166-1 alpha-2 del paese, esempio: IT
  latitude!: number | null; // Indica la latitudine del luogo in cui l'utente si è registrato
  longitude!: number | null; // Indica la longitudine del luogo in cui l'utente si è registrato

  dateOfBirth!: Date; // Data di nascita

  biography!: string | null;

  isVerified!: boolean;
  verifiedAt!: Date | null;

  isBanned!: boolean;
  bannedAt!: Date | null;
  bannedUntil!: Date | null;

  isShadowBanned!: boolean;
  shadowBannedAt!: Date | null;
  shadowBannedUntil!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;

  unarchived!: boolean;

  static tableName = "users"; // database table name
  static idColumn = "id"; // id column name
}

export type UsersShape = ModelObject<Users>;
