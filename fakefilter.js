fakeFilter = {}

function fakeCrossFilter(config) {
  config = config || {};
  config.data = config.data || [];
  config.projects = config.projects || [];
  config.mustExist = [];
  config.sort = config.sort || {};
  config.filterNullKey = config.filterNullKey || false;
  
  var dispatch = d3.dispatch('filterChanged', 'groupAll', 'groupTop', 'dataChanged', 'processStagesChange');

  // mongo related stuff
  config.group = config.group || {};
  config.keptFields = config.keptFields || {}; // stuff that is kept during projection
  config.postFields = config.postFields || {};
  
  function addFragment(name, fragment) {
    config.group[name] = fragment
    dispatch.processStagesChange();
    return fake;
  }
  
  function clearFragment(name) {
    delete config.group[name];
    dispatch.processStagesChange();
    return fake;
  }
  
  function dim(name) {
    if (!arguments.length) { return config.dim };
    config.dim = name;
    config.keptFields[name] = 1;
    addFragment('_id','$' + name);
    return fake;
  }
  
  function sum(field, name) {
    if (arguments.length < 2) { name = 'value' };
    config.keptFields[field] = 1;
    config.postFields[name] = 1;
    addFragment(name, {$sum:"$" + field});
    return fake;
  }
  
  function count(name) {
    if (!arguments.length) { name = 'value' };
    config.postFields[name] = 1;
    addFragment(name, {$sum: 1});
    return fake;
  }
  
  function avg(field, name) {
    if (arguments.length < 2) { name = 'value' };
    config.keptFields[field] = 1;
    config.postFields[name] = 1;
    addFragment(name, {$avg: "$" + field});
    return fake;
  }
  
  function max(field, name) {
    if (arguments.length < 2) { name = 'value' };
    config.keptFields[field] = 1;
    config.postFields[name] = 1;
    addFragment(name, {$max: "$" + field});
    return fake;
  }
  
  function min(field, name) {
    if (arguments.length < 2) { name = 'value' };
    config.keptFields[field] = 1;
    config.postFields[name] = 1;
    addFragment(name, {$min: "$" + field});
    return fake;
  }
  
  function limit(_) {
    if (!arguments.length) { return config.limit };
    config.limit = _;
    return fake;
  }
  
  function sort(_) {
    if (arguments.length == 0) { return config.sort };
    if (arguments.length < 2) { return config.sort[arguments[0]] };
    config.keptFields[arguments[0]] = 1; // unlikely, but... they could sort on something not transfered
    config.postFields[arguments[0]] = 1; // ...
    config.sort[arguments[0]] = arguments[1];
    return fake;
  }

  // for histograms
  function precision(_) {
    if (!arguments.length) return config.precision;
    config.precision = _;
    return fake;
  }

  function filterNullKey(_) {
    if (!arguments.length) return config.filterNullKey;
    config.filterNullKey = _;
    return fake;
  }

  // for caps in various directions.
  function minDim(_) {
    if (!arguments.length) return config.minDim;
    config.minDim = _;
    return fake;
  }
  
  function maxDim(_) {
    if (!arguments.length) return config.maxDim;
    config.maxDim = _;
    return fake;
  }
  
  function minField() {
    if (!arguments.length) return config.minField;
    config.minField = _;
    return fake;
  }
  
  function maxField() {
    if (!arguments.length) return config.maxField;
    config.maxField = _;
    return fake;
  }
  
  dateIntervals = {
   year: '$year',
   month: '$month',
   day: '$dayOfMonth',
   hour: '$hour',
   minutes: '$minute',
   seconds: '$second',
   milliseconds: '$millisecond',
   dayOfYear: '$dayOfYear',
   dayOfWeek: '$dayOfWeek',
   week: '$week'
  }
  
  dateIntervals = {
   year: '$year',
   month: '$month',
   day: '$dayOfMonth',
   hour: '$hour',
   minutes: '$minute',
   seconds: '$second',
   milliseconds: '$millisecond',
   dayOfYear: '$dayOfYear',
   dayOfWeek: '$dayOfWeek',
   week: '$week'
  }
  
  function binDate(field, dateInterval) {
    
  }
  
  // yes.... it doesn't look like it handles non integer percisions...
  // but.... it really does.
  function $project() {
    $p = JSON.parse(JSON.stringify(config.keptFields)) // clone, suprisingly really fast.
    if (config.precision) {
      $p[config.dim] = {$subtract:["$"+config.dim, {$mod:["$"+config.dim, config.precision]}]};
    }
    return [{$project:$p}];
  }
  
  function $postProject() {
    $p = JSON.parse(JSON.stringify(config.postFields)) // clone, suprisingly really fast.
    $p.key = "$_id";
    $p._id = 0;
    return [{$project:$p}];
  }
  
  function $group(_) {
    if (!arguments.length) return [{$group:config.group}];
    config.$group = _;
    dispatch.processStagesChange();
    return fake;
  }
  
  function $sort() {
    if (Object.keys(config.sort).length !== 0) {
      return [{$sort:config.sort}];
    }
    return [];
  }

  function $limit() {
    if (config.limit) {
      return [{$limit:config.limit}]
    }
    return [];
  }
  
  function $preDomain() {
    pd = [];
    if (config.maxDim) {
      $p = JSON.parse(JSON.stringify(config.keptFields));
      $p[config.dim] = {$cond:[{$gt:['$'+config.dim, config.maxDim]}, config.maxDim, '$'+config.dim]}
      pd.push({$project:$p});
    }
    return pd;
  }
  
  function $filterNullKey() {
    if (config.filterNullKey) {
      return [{$match:{key:{$ne:null}}}]
    }
    return [];
  }

  function data(_) {
    if (!arguments.length) return config.data;
    config.data = _;
    dispatch.dataChanged(_);
    return fake;
  }
  
  // crossfilter emulation related stuff
  function all() {
    dispatch.groupAll(config.data);
    return config.data;
  }
  
  function top(e) {
    dispatch.groupTop(config.data);
    return config.data.slice(0, e);
  }
  
  function buildMatch(filter) {
    result = {};
    if (Array.isArray(filter)) {
      result[config.dim] = {$gte:filter[0], $lt:filter[1] + (config.precision || 0)};
    } else {
      result[config.dim] = filter;
    }
    return result;
  }
  
  function $match(filters) {
    $or = [];
    for (filter of filters) {
      $or.push(buildMatch(filter))
    }
    if ($or.length > 0) {
      return [{$match:{$or:$or}}];
    } else {
      return [];
    }
  }
  
  function $query() {
    return $project()
      .concat($preDomain())
      .concat($group())
      .concat($postProject())
      .concat($filterNullKey())
      .concat($sort())
      .concat($limit());
  }

  // generate fake
  var fake = {};

  // metadata
  fake.isFake = true;
  d3.rebind(fake, dispatch, 'on');
  fake.filterChanged = dispatch.filterChanged;

  // mongo
  fake.addFragment = addFragment;
  fake.clearFragment = clearFragment;
  fake.dim = dim;
  fake.sum = sum;
  fake.count = count;
  fake.avg = avg;
  fake.max = max;
  fake.min = min;
  fake.maxDim = maxDim;
  fake.limit = limit;
  fake.sort = sort;
  fake.filterNullKey = filterNullKey;
  fake.precision = precision;
  fake.$match = $match;
  fake.$query = $query;

  // data
  fake.data = data;

  // group and dimension emulation
  fake.all = all;
  fake.top = top;
  fake.filter = dispatch.filterChanged;
  fake.filterExact = dispatch.filterChanged;
  fake.filterRange = dispatch.filterChanged;
  fake.filterFunction = dispatch.filterChanged;
  fake.filterAll = dispatch.filterChanged;

  return fake;
}

fakeFilter.fakeCrossFilter = fakeCrossFilter;
