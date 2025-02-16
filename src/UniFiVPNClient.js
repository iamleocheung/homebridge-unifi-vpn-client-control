const { Service, Characteristic } = require('./types');
const { debounce } = require('lodash');

module.exports = class UniFiVPNClient {
  constructor(plugin, homeKitAccessory) {
    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;

    this._hookCharacteristics();
  }

  _hookCharacteristics() {
    this.getCharacteristic(Characteristic.On).on('set', this.set.bind(this));
  }

  get site() {
    return this.homeKitAccessory.context.site;
  }

  get id() {
    return this.homeKitAccessory.context.id;
  }

  matches(vpnConfig) {
    return (
      this.id === vpnConfig.id
    );
  }

  static getContextForNetworkconfPort(site, networkconf, vpnConfig) {
    return {
      site,
      id: vpnConfig.id
    };
  }

  async update(site, networkconf, vpnConfig) {
    this.plugin.log.debug(`Updating accessory: ${networkconf.name} / #${vpnConfig.id} (${vpnConfig.name})`);
      
    this.homeKitAccessory.context = UniFiVPNClient.getContextForNetworkconfPort(site, networkconf, vpnConfig);

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, vpnConfig.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Leo Cheung')
      .setCharacteristic(Characteristic.Model, networkconf.name)
      .setCharacteristic(Characteristic.SerialNumber, networkconf.vpn_type + '_' + vpnConfig.id);

    if (!this.plugin.apiRequestPending) {
      this.getCharacteristic(Characteristic.On).updateValue(networkconf.enabled);
    }
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Switch);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Switch);
    }

    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  async _setAllProperties() {
    let port_override = {};
    let port = {};
    let networkconfs, foundNetworkconf;

    // Refresh networkconfs to get current port_overrides
    try {
      networkconfs = await this.plugin.client.getNetworkconfs(this.site.name);
      foundNetworkconf = networkconfs.data.find(networkconf => networkconf._id === this.id);
    } catch (e) {};

    if (!foundNetworkconf) {
      this.plugin.log.warn(`Networkconf (ID: ${this.id}) doesn't exists`);
      this.plugin.apiRequestPending = false;
      return await this.plugin.refreshNetworkconfs();
    }

    let enabled = this.getCharacteristic(Characteristic.On).value;
    
    let properties = {
        enabled: enabled
    };
    
    this.plugin.apiRequestPending = false;
    
    return this.setProperties(properties);
  }

  async setProperties(properties) {
    this.plugin.log.info(`Networkconf: ${this.id} - Update "enabled"`);

    try {
      await this.plugin.client.setNetworkconf(this.site.name, this.id, properties);
    } catch (e) {
      this.plugin.log.error(e);
      if (e.response) {
        this.plugin.log.error(e.response.data);
      }
    }
  }

  set(value, callback) {
    if (this.plugin.apiRequestPending) {
      setTimeout(this.set.bind(this), 1000, value, callback);
    } else {
      this.plugin.apiRequestPending = true;
      this._setAllProperties();
      callback();
    }
  }
}
