/**
 * The methods the Worker calls on each Durable Object. They live apart from the classes so the Worker's env type
 * does not depend on them: the classes need that env type themselves.
 */
export interface ScoutRpc {
  start(runId: string): Promise<void>;
}

export interface CatalogueView {
  /** The benefits an answer is about, by id. */
  readonly benefitIds: readonly string[];
}

export interface AdvisorReply {
  readonly answer: string;
  /** What the catalogue on screen should show, when the answer names benefits from it. */
  readonly view?: CatalogueView;
}

export interface AdvisorRpc {
  ask(question: string): Promise<AdvisorReply>;
}

// A stub only exposes methods of a class branded as a Durable Object, so the interfaces are applied here, once.
export const scoutStub = (namespace: { getByName(name: string): unknown }, name: string) =>
  namespace.getByName(name) as ScoutRpc;
export const advisorStub = (namespace: { getByName(name: string): unknown }, name: string) =>
  namespace.getByName(name) as AdvisorRpc;
