export default class Stack {
  public technologies: string[];
  public platform: string;

  constructor(...stack: string[]) {
    this.technologies = stack
      .reduce((acc, tech) => {
        if (!tech) {
          return acc;
        } else if (tech.constructor === Array) {
          return acc.concat(tech);
        } else {
          return acc.concat(tech.split(':'));
        }
      }, [])
      .filter((v, i, a) => a.indexOf(v) === i);
    this.platform = Stack.getPlatform(this.technologies);
    if (!this.platform) {
      throw new Error(
        `stack should include 'webpack' and one of 'server', 'web', 'android', 'ios', stack: ${this.technologies}`
      );
    }
  }

  public static getPlatform(stack: string[]): string | undefined {
    let platform;
    if (stack) {
      if (stack.indexOf('server') >= 0) {
        platform = 'server';
      } else if (stack.indexOf('web') >= 0) {
        platform = 'web';
      } else if (stack.indexOf('android') >= 0) {
        platform = 'android';
      } else if (stack.indexOf('ios') >= 0) {
        platform = 'ios';
      }
    }
    return platform;
  }

  public hasAny(technologies): boolean {
    const array = technologies.constructor === Array ? technologies : [technologies];
    for (const feature of array) {
      if (this.technologies.indexOf(feature) >= 0) {
        return true;
      }
    }
    return false;
  }

  public hasAll(technologies): boolean {
    const array = technologies.constructor === Array ? technologies : [technologies];
    for (const feature of array) {
      if (this.technologies.indexOf(feature) < 0) {
        return false;
      }
    }
    return true;
  }
}
