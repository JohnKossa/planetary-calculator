Object.filter = (obj, predicate) =>
	Object.keys(obj)
		.filter( key => predicate(obj[key]) )
		.reduce( (res, key) => (res[key] = obj[key], res), {} );

function getValueTypeFromValue(value){
	if(!Array.isArray(value)){
		return VALUE_TYPE.FINITE;
	}
	if(value[0] === -Infinity && value[1] === Infinity){
		return VALUE_TYPE.UNCONSTRAINED_RANGE;
	}
	return VALUE_TYPE.CONSTRAINED_RANGE;
}

function removeDuplicates (list){
	return [...new Set(list)];
}

function getValueRange(variable){
	return Math.abs(variable.value[1]-variable.value[0])
}