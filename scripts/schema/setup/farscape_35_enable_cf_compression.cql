USE farscape;

-- Enable snappy compression for some CFs.
--
-- Note: We might want to experience with using DeflateCompressor for 'events'
-- CF because it offers better compression ration and there will be alot of
-- duplicated data in this CF.
-- TODO: Also experiment with chunk suzes

ALTER COLUMNFAMILY accounts
  WITH compression_parameters:sstable_compression = 'SnappyCompressor'
  AND compression_parameters:chunk_length_kb = 64;

ALTER COLUMNFAMILY configuration_values
  WITH compression_parameters:sstable_compression = 'SnappyCompressor'
  AND compression_parameters:chunk_length_kb = 64;

ALTER COLUMNFAMILY events
  WITH compression_parameters:sstable_compression = 'SnappyCompressor'
  AND compression_parameters:chunk_length_kb = 64;

-- Disable compression for some CFs where it doesn't make sense to use it
ALTER COLUMNFAMILY services WITH compression_parameters:sstable_compression = '';
