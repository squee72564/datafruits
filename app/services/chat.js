import Service, { inject as service } from '@ember/service';
import { Presence } from 'phoenix';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { tracked } from '@glimmer/tracking';

export default class ChatService extends Service {
  @service socket;
  @service session;
  @service eventBus;
  @service currentUser;

  @tracked presences = {};
  @tracked messages = [];
  @tracked joinedChat = false;
  @tracked gifsEnabled = true;
  @tracked token = '';

  @tracked isScrolledToBottom = true;

  join(username, token) {
    this.joinedChat = true;
    this.username = username;
    this.token = token;
  }

  join_and_authorize(user, token) {
    this.joinedChat = true;
    this.username = user.username;
    this.token = token;

    const avatarUrl = user.avatarUrl;
    const role = user.role;
    const style = user.style;
    const pronouns = user.pronouns;
    this.push('authorize_token', {
      user: user.username,
      timestamp: Date.now(),
      token: token,
      avatarUrl,
      role,
      style,
      pronouns,
    });
  }

  disconnect() {
    // need to broadcast a disconnect here or it will look like user is still in the chat to everyone
    this.chan.push('disconnect', { user: this.username });
    this.joinedChat = false;
  }

  push(message, object) {
    this.chan.push(message, object);
  }

  constructor() {
    super(...arguments);

    let socket = this.socket.socket;

    this.chan = socket.channel('rooms:lobby', {});

    this.chan
      .join()
      .receive('ignore', function () {
        //return console.log("auth error");
      })
      .receive('ok', () => {
        if (isDestroyed(this) || isDestroying(this)) return;
        if (this.session.isAuthenticated && this.currentUser.user) {
          this.join_and_authorize(this.currentUser.user, this.session.data.authenticated.token);
        }
        return console.log('chat join ok'); // eslint-disable-line no-console
      })
      .receive('timeout', function () {
        //return console.log("Connection interruption");
      });

    this.chan.onError(function (/*e*/) {
      //return console.log("something went wrong", e);
    });

    this.chan.onClose(function (/*e*/) {
      //return console.log("channel closed", e);
    });

    this.chan.on('new:msg', (msg) => {
      if (msg['role']) {
        msg['role'] = msg.role.split(' ');
      }
      this.messages.pushObject(msg);
    });

    this.chan.on('new:fruit_tip', (msg) => {
      console.log(`got new fruit tip: ${msg}`); // eslint-disable-line no-console
      this.eventBus.publish('fruitTipped', msg.fruit);
    });

    this.chan.on('authorized', (msg) => {
      this.username = msg.user;
      const token = msg.token;
      if (token) {
        this.token = msg.token;
        // load currentUser
        this.currentUser
          .load()
          .then(() => {
            console.log('user authorized with token'); // eslint-disable-line no-console
            this.joinedChat = true;
          })
          .catch(() => this.session.invalidate());
      } else {
        console.log('user authorized'); // eslint-disable-line no-console
        this.joinedChat = true;
      }
      // fetch currentUser here? ???
    });

    this.chan.on('notauthorized', function (msg) {
      alert(msg.error);
    });

    // user banned
    this.chan.on('disconnect', (/*msg*/) => {
      this.joinedChat = false;
    });

    this.chan.on('banned', (msg) => {
      console.log(`user banned:`); // eslint-disable-line no-console
      console.log(msg); // eslint-disable-line no-console
    });

    this.chan.on('presence_state', (state) => {
      if (isDestroyed(this) || isDestroying(this)) return;
      let presences = this.presences;
      this.presences = Presence.syncState(presences, state);
    });

    this.chan.on('presence_diff', (diff) => {
      if (isDestroyed(this) || isDestroying(this)) return;
      let presences = this.presences;
      this.presences = Presence.syncDiff(presences, diff);
    });
  }
}
