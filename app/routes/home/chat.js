import Route from '@ember/routing/route';
import ENV from 'datafruits13/config/environment';

export default class ChatRoute extends Route {
  beforeModel() {
    return this._loadCurrentUser();
  }

  afterModel() {
    this.setHeadTags();
  }

  setHeadTags() {
    const headTags = ENV.headTags;
    this.set('headTags', Object.values(headTags));
  }
}
