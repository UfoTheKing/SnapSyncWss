import { HttpException } from "@/exceptions/HttpException";
import { SnapShape } from "@/interfaces/snaps_shapes.interface";
import { SnapsShapes } from "@/models/snaps_shapes.model";

class SnapShapeService {
  public async findShapShapeById(id: number): Promise<SnapShape> {
    const findOne = await SnapsShapes.query().whereNotDeleted().findById(id);
    if (!findOne) {
      throw new HttpException(404, "Shape not found.");
    }

    return findOne;
  }
}

export default SnapShapeService;
