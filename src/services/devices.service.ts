import { HttpException } from "@/exceptions/HttpException";
import { Device } from "@/interfaces/devices.interface";
import { Devices } from "@/models/devices.model";

class DeviceService {
  public async findDeviceByUuid(uuid: string): Promise<Device> {
    const findOne = await Devices.query().whereNotDeleted().findOne({
      uuid: uuid,
    });

    if (!findOne) throw new HttpException(404, "Device not found");

    return findOne;
  }
}

export default DeviceService;
