import Zen from './Zen';

export interface ConfigPlugin {
  configure(builder, zen: Zen);
}
