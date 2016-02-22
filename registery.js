fakeFilter.registry = function registry() {
  
  var config = {};

  // this chunk is in essence a smart debouncer
  var busy = false;
  var callbackInWaiting = undefined;
  
  function queueWork(callback) {
    callbackInWaiting = callback;
    queryIfNotBusy();
  }
  
  function queryIfNotBusy() {
    if (!busy && callbackInWaiting) {
      busy = true; // if we were not before, we are now...
      callback = callbackInWaiting;
      callbackInWaiting = undefined;
      fetchData(callback);
    }
  }
  // end smart debouncer
  
  function forAllFakeCharts(f) {
    var result = [];
    for (var chart of dc.chartRegistry.list()) {
      if (chart.group().isFake) {
        result.push(f(chart));
      }
    }
    return result;
  }
  
  function forAllFakeChartsExcept(c, f) {
    var result = [];
    for (chart of dc.chartRegistry.list()) {
      if (chart.group().isFake && (chart !== c)) {
        result.push(f(chart));
      }
    }
    return result;
  }
  
  function getData() {
    forAllFakeCharts(function (c) {
      makeMatch(chart);
    })
  }
  
  function register(chart) {
    // replace filter handler in dc.js so it doesn't make 2 calls to filter each time a filter happens.
    chart.filterHandler(
      function (dimension, filters) {
        // dimension.filter(null); // bad filter handler! no biscuit!
        if (filters.length === 0) {
          dimension.filter(null);
        } else {
          dimension.filterFunction(function (d) {
            for (var i = 0; i < filters.length; i++) {
              var filter = filters[i];
              if (filter.isFiltered && filter.isFiltered(d)) {
                  return true;
              } else if (filter <= d && filter >= d) {
                  return true;
              }
            }
            return false;
          });
        }
        return filters;
      }
    )
    chart.group().on('filterChanged.fake', somethingFiltered);
  }
  
  function registerAll() {
    forAllFakeCharts(register)
  }
  
  function findGroup(chartName) {
    for (chart of dc.chartRegistry.list()) {
      if (chart.anchorName() == chartName) {
        return chart.group();
      }
    }
  }
  
  function processResponse(res) {
    for (cres of res) {
      findGroup(cres.chart).data(cres.results);
    }
  }
  
  function fetchData(callback) {
    query = forAllFakeCharts(makeQuery);
    postQuery(query, function (d) {
      response = JSON.parse(d)
      if (response.err) {
        console.log('server responded with failure' , err)
      } else {
        processResponse(response.data);
      }
      callback();
      busy = false; // finished the work
      queryIfNotBusy();
    });
  }

  function somethingFiltered() {
    queueWork(function(){dc.redrawAll()});
  }
  
  function buildMatches(chart) {
    return chart.group().$match(chart.filters())
  }
  
  function makeQuery(chart) {
    matches = forAllFakeChartsExcept(chart, buildMatches) // get the filters
    flattenedMatches = [];
    for (match of matches) {
      flattenedMatches = flattenedMatches.concat(match);
    }
    query = chart.group().$query(); // get the query
    result =  {chart:chart.anchorName(), query:flattenedMatches.concat(query)}; // query with the filters ;)
    return result;
  }
  
  
  function url(_) {
    if (!arguments.length) return config.url;
    config.url = _;
    return registry;
  }
  
  function collection(_) {
    if (!arguments.length) return config.collection;
    config.collection = _;
    return registry;
  }

  // no point adding all of jquery for one call - no matter how nasty the call is ;)
  // so we do it by hand.
  function postQuery(json, callback) {
    var data = JSON.stringify(json)
    var xhr = new XMLHttpRequest();
    xhr.open('POST', config.url + '/agg/' + config.collection);
    xhr.addEventListener('load', function (e) {
      callback(e.target.response);
    }, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(data);
  }
  
  registry.registerAll = registerAll;
  registry.register = register;
  registry.fetchData = fetchData;
  registry.url = url;
  registry.collection = collection;
  
  return registry;
  
}();