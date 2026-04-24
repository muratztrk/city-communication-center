namespace CityCommunicationCenter.Application.Abstractions;

public interface ICommand<out TResponse> : Mediator.ICommand<TResponse>;

public interface IQuery<out TResponse> : Mediator.IQuery<TResponse>;

public interface ICommandHandler<in TCommand, TResponse> : Mediator.ICommandHandler<TCommand, TResponse>
	where TCommand : Mediator.ICommand<TResponse>;

public interface IQueryHandler<in TQuery, TResponse> : Mediator.IQueryHandler<TQuery, TResponse>
	where TQuery : Mediator.IQuery<TResponse>;