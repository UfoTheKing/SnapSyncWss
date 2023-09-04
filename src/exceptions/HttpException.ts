export class HttpException extends Error {
  public status: number;
  public message: string;
  public action: string | null;
  public data: any;

  constructor(
    status: number,
    message: string,
    action?: string | null,
    data?: any
  ) {
    super(message);
    this.status = status;
    this.message = message;
    this.action = action || null;
    this.data = data;
  }
}
