/**
 * The run map: a layered DAG of rooms. The player starts below layer 0, picks
 * any layer-0 node, and after clearing a room may only move along its outgoing
 * edges — every path converges on the single boss node in the final layer.
 */
export interface MapNode {
  id: number;
  /** Layer index, 0 = first rooms, last = boss. */
  layer: number;
  /** Position within the layer (left to right). */
  col: number;
  /** Id of the stage played when this room is entered (key into STAGES). */
  stageId: string;
  /** Ids of the nodes in the next layer this room connects to. */
  next: number[];
  cleared: boolean;
}

export class GameMap {
  /** Id of the room the player is in; -1 before the first room is entered. */
  current = -1;

  constructor(
    readonly nodes: readonly MapNode[],
    /** Node ids per layer, left to right. */
    readonly layers: readonly (readonly number[])[],
  ) {}

  get currentNode(): MapNode | null {
    return this.current < 0 ? null : this.nodes[this.current];
  }

  /** The rooms the player may enter next. */
  get reachable(): MapNode[] {
    const ids = this.current < 0 ? this.layers[0] : this.nodes[this.current].next;
    return ids.map((id) => this.nodes[id]);
  }

  /** True once the player sits on the final (boss) node. */
  get onFinalNode(): boolean {
    return this.current >= 0 && this.nodes[this.current].layer === this.layers.length - 1;
  }

  enter(id: number): void {
    this.current = id;
  }

  markCleared(): void {
    const node = this.currentNode;
    if (node) node.cleared = true;
  }
}
