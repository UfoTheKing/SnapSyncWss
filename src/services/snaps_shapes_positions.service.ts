import { HttpException } from "@/exceptions/HttpException";
import { SnapShapePosition } from "@/interfaces/snaps_shapes_positions.interface";
import { SnapsShapesPositions } from "@/models/snaps_shapes_positions.model";

class SnapShapePositionService {
  public async findSnapShapePositionById(
    id: number
  ): Promise<SnapShapePosition> {
    const data = await SnapsShapesPositions.query()
      .whereNotDeleted()
      .findById(id);
    if (!data) throw new HttpException(404, "Shape position not found.");

    return data;
  }
}

export default SnapShapePositionService;
