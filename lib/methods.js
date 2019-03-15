'use strict';

const APIRequest = require('./api-request');
const Session = require('./session');
const Pin = require('./pin');
const _ = require('lodash');
class Methods {
  init() {
    this.pin = new Pin().getInstance();
  }

  /**
   * @description Send item to specified pile
   * @private
   * @param {String} pile Pile name [trade/club]
   * @param {Number} itemId Item ID
   */
  async _sendToPile(pile, itemId = null) {
    const requestParams = {
      method : 'PUT',
      url    : 'item',
      params : {
        itemData : [{
          pile, 
          id : itemId
        }]
      }
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Send card to trade pile
   * @param {Number} itemId Item ID
   * @param {Boolean} safe False to disable tradepile free space check 
   */
  async sendToTradepile(itemId, safe = true) {
    if (safe) {
      // TODO: check tradepile count
    }
    return await this._sendToPile('trade', itemId);
  }

  /**
   * @description Send card to club
   * @param {Number} itemId Item  ID
   */
  async sendToClub(itemId) {
    return await this._sendToPile('club', itemId);
  }

  /**
   * @description Method for searching cards on trade market
   * @param {Object} params
   * @param {String} params.cardType Card type
   * @param {Number} params.minPrice Minimum bid price
   * @param {Number} params.maxPrice Maximum bid price
   * @param {Number} params.minBuy Minimum buy now price
   * @param {Number} params.maxBuy Maximum buy now price
   * @param {String} params.level Card level [gold/silver/bronze]
   * @param {Number} params.start Start page sent to server so it supposed to be 12/15, 24/30 etc. (default platform page_size*n)
   * @param {String} params.category Card category [fitness/playStyle/?] 
   * @param {Number} params.assetId Asset ID
   * @param {Number} params.defId Definition ID
   * @param {Number} params.league League ID
   * @param {Number} params.club Club ID
   * @param {String} params.position Player position
   * @param {String} params.zone [defense/midfiers/attackers]
   * @param {Number} params.nationality Nation ID
   * @param {Boolean} params.rare Set 'true' for searching special cards
   * @param {Number} params.playStyle Play style
   * @param {Number} params.pageSize Items per page
   */
  async search({ 
    cardType = 'player', minPrice, maxPrice, minBuy, maxBuy, level, start = 0, category, 
    assetId, defId, league, club, position, zone, nationality, rare = false, playStyle, pageSize = 21
  }) {
    if (start === 0) {
      const events = this.pin.event('page_view', 'Transfer Market Search');
      await this.pin.send(events);
    }

    let params = {
      start,
      num  : pageSize,
      type : cardType
    };

    if (!_.isNil(level)) {
      params.lev = level;
    }

    if (!_.isNil(category)) {
      params.cat = category;
    }

    if (!_.isNil(assetId)) {
      params.maskedDefId = assetId;
    }

    if (!_.isNil(defId)) {
      params.definitionId = defId;
    }

    if (!_.isNil(minPrice)) {
      params.micr = minPrice;
    }

    if (!_.isNil(maxPrice)) {
      params.macr = maxPrice;
    }

    if (!_.isNil(minBuy)) {
      params.minb = minBuy;
    }

    if (!_.isNil(maxBuy)) {
      params.maxb = maxBuy;
    }

    if (!_.isNil(league)) {
      params.leag = league;
    }

    if (!_.isNil(club)) {
      params.team = club;
    }

    if (!_.isNil(position)) {
      params.pos = position;
    }

    if (!_.isNil(zone)) {
      params.zone = zone;
    }

    if (!_.isNil(nationality)) {
      params.nat = nationality;
    }

    if (rare) {
      params.rare = 'SP';
    }

    if (!_.isNil(playStyle)) {
      params.playStyle = playStyle;
    }

    const requestParams = {
      method : 'GET',
      url    : 'transfermarket',
      params
    };

    const response = await APIRequest(requestParams);

    if (start === 0) {
      const events = [
        this.pin.event('page_view', 'Transfer Market Results - List View'),
        this.pin.event('page_view', 'Item - Detail View')
      ];
      await this.pin.send(events);
    }

    return _.get(response, 'auctionInfo', []);
  }

  /**
   * @description Bid a card on trade market
   * @param {*} tradeId Trade ID
   * @param {*} bid Bid
   */
  async bid(tradeId, bid) {
    const requestParams = {
      method : 'PUT',
      url    : `trade/${tradeId}/bid`,
      params : {
        bid
      }
    };

    let response;
    try {
      response = await APIRequest(requestParams);
    } catch (err) {
      if (err.statusCode === 461) {
        console.log('Permission Denied. Probably outbid.')
        return [];
      }
    }

    const events = [
      this.pin.event('connection'),
      this.pin.event('boot_end', false, false, false, 'normal')
    ];

    await this.pin.send(events);

    if (_.get(response, 'credits')) this._updateCredits(response.credits);

    return response;
  }

  /**
   * @description Return trade status
   * @param {*} tradeId Trade ID
   */
  async tradeStatus(tradeId) {
    const requestParams = {
      method : 'GET',
      url    : 'trade/status',
      params : {
        tradeIds : tradeId
      }
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Put a card into trade market
   * @param {Object} params
   * @param {Object} params.itemId Item ID
   * @param {Object} params.startingBid Starting bid
   * @param {Object} params.buyNowPrice Buy now price
   * @param {Object} params.duration Bid duration
   * @param {Object} params.fast Whether or not to check trade status
   */
  async sell({ itemId, startingBid, buyNowPrice, duration = 3600, fast = false }) {
    const requestParams = {
      method : 'POST',
      url    : 'auctionhouse',
      params : {
        itemData : {
          id : itemId
        },
        buyNowPrice,
        startingBid,
        duration
      }
    };

    let response = await APIRequest(requestParams);

    if (fast === false && _.get(response, 'id')) {
      await this.tradeStatus(response.id);
    }

    return response;
  }

  /**
   * @description Quick sell a card
   * @param {Array} itemIds Item ID
   */
  async quickSell(itemIds) {
    if (_.isArray(itemIds)) itemIds = itemIds.join(',');
    const requestParams = {
      method : 'DELETE',
      url    : 'item',
      params : {
        itemIds
      }
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Remove a sold card from trade pile
   * @param {Number} tradeId Item ID
   */
  async tradepileDelete(tradeId) {
    const requestParams = {
      method : 'DELETE',
      url    : `trade/${tradeId}`
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Remove a card from  watch list
   * @param {Number|Array} tradeIds An array of trade IDs or a single trade ID number
   */
  async watchlistDelete(tradeIds) {
    if (_.isArray(tradeIds)) tradeIds = tradeIds.join(',');
    const requestParams = {
      method : 'DELETE',
      url    : 'watchlist',
      params : {
        tradeId : tradeIds
      }
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Clear tradepile
   */
  async tradepileClear() {
    const requestParams = {
      method : 'DELETE',
      url    : 'trade/sold'
    };

    return await APIRequest(requestParams);
  }
  
  /**
   * @description Send card to watch list
   * @param {Number} tradeId Item ID
   * @param {Boolean} safe False to disable tradepile free space check 
   */
  async sendToWatchlist(tradeId, safe = true) {
    if (safe) {
      // TODO: check watchlist count
    }
    const requestParams = {
      method : 'PUT',
      url    : 'watchlist',
      params : {
        auctionInfo : [{
          id : tradeId
        }]
      }
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description ReList all cards in tradepile. Prices might change.
   */
  async relist() {
    const requestParams = {
      method : 'PUT',
      url    : 'auctionhouse/relist'
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Refresh credit amount to let know that we're still online. Returns credit amount.
   */
  async keepalive() {
    const requestParams = {
      method : 'GET',
      url    : 'user/credits'
    };

    return await APIRequest(requestParams);
  }

  /**
   * @description Return size of tradepile and watchlist.
   */
  async pileSize() {
    const userInfo = Session.load('userInfo');
    return {
      tradepile : userInfo.__usermassinfo.pileSizeClientData.entries[0].value,
      watchlist : userInfo.__usermassinfo.pileSizeClientData.entries[2].value
    }
  }

  /**
   * @description Get unassigned items.
   */
  async unassigned() {
    const requestParams = {
      method : 'GET',
      url    : 'purchased/items'
    };

    let response = await APIRequest(requestParams);

    await this.pin.event('page_view', 'Unassigned Items - List View');
    await this.pin.send();

    return response;
  }

  /**
   * @description Get tradepile items.
   */
  async tradepile() {
    const requestParams = {
      method : 'GET',
      url    : 'tradepile'
    };

    let response = await APIRequest(requestParams);

    await this.pin.event('page_view', 'Transfer List - List View');
    await this.pin.send();

    if (response.credits) this._updateCredits(response.credits);

    return response;
  }

  /**
   * @description Get watchlist items.
   */
  async watchlist() {
    const requestParams = {
      method : 'GET',
      url    : 'watchlist'
    };

    let response = await APIRequest(requestParams);

    await this.pin.event('page_view', 'Transfer Targets - List View');
    await this.pin.send();

    if (response.credits) this._updateCredits(response.credits);

    return response;
  }

  // buyPack
  // openPack
  // sbsSets
  // clubConsumables
  // objectives
  // sendToSbs
  // applyConsumable

  _updateCredits(credits) {
    let userInfo = Session.load('userInfo');
    userInfo.credits = credits;
  }

}

module.exports = Methods;