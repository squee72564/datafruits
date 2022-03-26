import Model, { belongsTo, attr } from '@ember-data/model';

export default class UserFollowModel extends Model {
  @belongsTo('user')
  user;
  @belongsTo('dj')
  followee;

  @attr() followeeName;
}
