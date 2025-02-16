# Homebridge UniFi VPN Client Control

HomeKit support to control the VPN Client status of UniFi Switches using [Homebridge](https://homebridge.io).
With `homebridge-unifi-vpn-client-control` you can enable/disable VPN Client of UniFi system.

## Configuration

For most people, I recommend using [Homebridge Configuration web UI](https://github.com/oznu/homebridge-config-ui-x) to configure this plugin rather than doing it directly. It's easier to use and less prone to typos, leading to other problems.

You can use your Ubiquiti account credentials, though 2FA is not currently supported.

That said, **I strongly recommend creating a local user just for Homebridge instead of using this option.** The local UniFi user should have the `SiteAdmin` role to control the VPN Client status.

[UniFi Manage Users and Roles](https://help.ui.com/hc/en-us/articles/1500011491541-UniFi-Manage-users-and-user-roles)

**Example config**

```js
{
  "platforms": [
    {
      "platform": "UniFiVPNClientControl",
      "name": "UniFi VPN Client Control",
      "url": "https://CONTROLLER_ADDRESS:443",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD",
      "refreshInterval": 60, // seconds - optional
      "apiMode": null, // optional ("old" | "UniFiOS")
      "vpns": [
        {
            "id": "zq9r4p23la5yfqm4b8h73a3t", // id of network config
            "name": "ALTERNATIVE NAME" // optional
        }
      ]
    }
  ]
}
```

The plugin should work with old firmwares (!= UniFi OS) and UniFi OS firmwares.

The plugin will try to find out which API is present to use the right API endpoints.
If it doesn't work you can force a specific API mode (`apiMode` - `old` | `UniFiOS`).
