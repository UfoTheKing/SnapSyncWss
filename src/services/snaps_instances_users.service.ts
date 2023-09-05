import { SnapInstanceUser } from "@/interfaces/snaps_instances_users.interface";
import { SnapsInstancesUsers } from "@/models/snaps_instances_users.model";

class SnapInstanceUserService {
  public async findSnapsInstancesUsersBySnapInstanceId(
    snapInstanceId: number
  ): Promise<SnapInstanceUser[]> {
    const data = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .where({ snapInstanceId: snapInstanceId });

    return data;
  }
}

export default SnapInstanceUserService;
