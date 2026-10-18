/** 所有"用户可见"的领域错误的基类；message 即规范里 `error:` 之后的文本。 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
