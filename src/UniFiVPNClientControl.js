const { homebridge, Accessory, UUIDGen } = require('./types');
const UniFiAPI = require('./UniFiAPI');
const UniFiVPNClient = require('./UniFiVPNClient');

const PLUGIN_NAME = 'homebridge-unifi-vpn-client-control';
const PLATFORM_NAME = 'UniFiVPNClientControl';

const DEFAULT_REFRESH_INTERVAL = 60000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = class UniFiVPNClientControl {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.client = this.getClient();
    this.apiRequestPending = false;

    this.accessories = [];

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  static register() {
    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, UniFiVPNClientControl);
  }

  getClient() {
    return new UniFiAPI({
      url: this.config.url,
      username: this.config.username,
      password: this.config.password,
      apiMode: this.config.apiMode
    }, this.log);
  }

  async didFinishLaunching() {
    await this.client.login();

    this.runLoop();
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshNetworkconfs();
      } catch (e) { }

      await delay(interval);
    }
  }

  async refreshNetworkconfs() {
    this.log.debug('Refreshing networkconfs...');

    try {
      let sites = await this.client.getSites();

      for (let site of sites.data) {
        let networkconfs = await this.client.getNetworkconfs(site.name);

        await this.loadNetworkconfs(site, networkconfs.data);
      }
    } catch (e) { }
  }

  async loadNetworkconfs(site, networkconfs) {
    let foundAccessories = [];

    for (let networkconf of networkconfs) {
      this.log.debug('Find matching networkconfs...');

      for (let vpnConfig of this.config.vpns) {
        if (vpnConfig.id === networkconf._id) {
          if (networkconf.purpose != 'vpn-client') {
            this.log.warn(`Networkconf config is wrong - it is not VPN Client: ${networkconf.name} (ID: ${networkconf._id})`)
            continue;
          }

          this.log.debug(`Found networkconf VPN Client: ${networkconf.name} (ID: ${networkconf._id}`);

          // Set name attribute to use in HomeKit
          vpnConfig.name = vpnConfig.name || networkconf.name;

          let accessory = await this.loadNetworkconf(site, networkconf, vpnConfig);
          if (accessory) {
            foundAccessories.push(accessory);
          }
        }
      }
    }

    let removedAccessories = this.accessories.filter(a => !foundAccessories.includes(a));
    if (removedAccessories.length > 0) {
      this.log.info(`Removing ${removedAccessories.length} networkconf(s)`);
      let removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories);
    }

    this.accessories = foundAccessories;
  }

  async loadNetworkconf(site, networkconf, vpnConfig) {
    let accessory = this.accessories.find(a => a.matches(vpnConfig));

    if (!accessory) {
      let homeKitAccessory = this.createHomeKitAccessory(site, networkconf, vpnConfig);
      this.log.info(`Setting up new accessory: ${networkconf.name} / #${vpnConfig.id} (${vpnConfig.name})`);

      accessory = new UniFiVPNClient(this, homeKitAccessory);
      this.accessories.push(accessory);
    }

    await accessory.update(site, networkconf, vpnConfig);

    return accessory;
  }

  createHomeKitAccessory(site, networkconf, vpnConfig) {
    let uuid = UUIDGen.generate(vpnConfig.id);
    let homeKitAccessory = new Accessory(vpnConfig.name, uuid);

    homeKitAccessory.context = UniFiVPNClient.getContextForNetworkconfPort(site, vpnConfig);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory]);

    return homeKitAccessory;
  }

  // Homebridge calls this method on boot to reinitialize previously-discovered networkconfs
  configureAccessory(homeKitAccessory) {
    // Make sure we haven't set up this accessory already
    let accessory = this.accessories.find(a => a.homeKitAccessory === homeKitAccessory);

    if (accessory) {
      return;
    }

    accessory = new UniFiVPNClient(this, homeKitAccessory);
    this.accessories.push(accessory);
  }
};
