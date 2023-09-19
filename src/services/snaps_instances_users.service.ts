import { SnapInstanceUser } from "@/interfaces/snaps_instances_users.interface";
import { SnapsInstancesUsers } from "@/models/snaps_instances_users.model";
import {
  GetObjectCommand,
  GetObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET_NAME,
  S3_BUCKET_REGION,
  S3_SECRET_ACCESS_KEY,
} from "@/config";
import { HttpException } from "@/exceptions/HttpException";

const s3 = new S3Client({
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || "",
    secretAccessKey: S3_SECRET_ACCESS_KEY || "",
  },
  region: S3_BUCKET_REGION,
});

class SnapInstanceUserService {
  public async findSnapsInstancesUsersBySnapInstanceId(
    snapInstanceId: number
  ): Promise<SnapInstanceUser[]> {
    const data = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .where({ snapInstanceId: snapInstanceId });

    return data;
  }

  public async imageUrlById(id: number): Promise<string> {
    const findOneUserData = await SnapsInstancesUsers.query()
      .whereNotDeleted()
      .findById(id);
    if (!findOneUserData)
      throw new HttpException(404, "SnapInstanceUser not found");
    if (!findOneUserData.s3Key) throw new HttpException(404, "Image not found");

    const params: GetObjectCommandInput = {
      Bucket: S3_BUCKET_NAME,
      Key: findOneUserData.s3Key,
    };

    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return url;
  }
}

export default SnapInstanceUserService;
